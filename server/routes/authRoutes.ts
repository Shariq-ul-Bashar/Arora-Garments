import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import {
  authRateLimiter,
  clearSessionCookie,
  getUserWithRoles,
  requireAuth,
  setSessionCookie,
} from '../auth.ts';

const router = Router();

const registerSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(10).max(15),
  email: z.string().trim().email().optional().or(z.literal('')),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1),
});

function mergeGuestCart(userId: string, guestToken?: string) {
  if (!guestToken) return;
  const guestCart = db.prepare('SELECT id FROM carts WHERE guest_token = ?').get(guestToken) as { id: string } | undefined;
  if (!guestCart) return;

  let userCart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as { id: string } | undefined;
  if (!userCart) {
    const newId = crypto.randomUUID();
    db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run(newId, userId);
    userCart = { id: newId };
  }

  const guestItems = db.prepare('SELECT variant_id, quantity FROM cart_items WHERE cart_id = ?').all(guestCart.id) as Array<{
    variant_id: string;
    quantity: number;
  }>;

  for (const item of guestItems) {
    const existing = db
      .prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?')
      .get(userCart.id, item.variant_id) as { id: string; quantity: number } | undefined;
    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(existing.quantity + item.quantity, existing.id);
    } else {
      db.prepare('INSERT INTO cart_items (id, cart_id, variant_id, quantity) VALUES (?, ?, ?, ?)').run(
        crypto.randomUUID(),
        userCart.id,
        item.variant_id,
        item.quantity
      );
    }
  }
  db.prepare('DELETE FROM carts WHERE id = ?').run(guestCart.id);
}

router.post('/register', authRateLimiter, (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data' });
  }
  const { full_name, phone, email, password } = parsed.data;
  const cleanPhone = phone.replace(/\s+/g, '');
  const cleanEmail = email ? email.toLowerCase() : null;

  const existing = db
    .prepare('SELECT id FROM profiles WHERE phone = ? OR (email IS NOT NULL AND email = ?)')
    .get(cleanPhone, cleanEmail) as { id: string } | undefined;
  if (existing) {
    return res.status(409).json({ error: 'An account with this mobile number or email already exists.' });
  }

  const userId = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 10);

  db.transaction(() => {
    db.prepare(
      'INSERT INTO profiles (id, full_name, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, full_name, cleanPhone, cleanEmail, hash);
    // Strict security: public registration ONLY ever grants 'customer' role
    db.prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)').run(crypto.randomUUID(), userId, 'customer');
    db.prepare('INSERT INTO wishlists (id, user_id) VALUES (?, ?)').run(crypto.randomUUID(), userId);
  })();

  mergeGuestCart(userId, req.guestToken);
  const token = setSessionCookie(req, res, userId);
  const user = getUserWithRoles(userId);
  return res.status(201).json({ user, token });
});

router.post('/login', authRateLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please enter email/phone and password.' });
  }
  const { identifier, password } = parsed.data;
  const norm = identifier.trim().toLowerCase();
  const cleanPhone = identifier.replace(/\s+/g, '');

  const profile = db
    .prepare('SELECT id, password_hash, is_active FROM profiles WHERE lower(email) = ? OR phone = ?')
    .get(norm, cleanPhone) as { id: string; password_hash: string | null; is_active: number } | undefined;

  if (!profile || !profile.password_hash || !profile.is_active) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  if (!bcrypt.compareSync(password, profile.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  mergeGuestCart(profile.id, req.guestToken);
  const token = setSessionCookie(req, res, profile.id);
  const user = getUserWithRoles(profile.id);
  return res.json({ user, token });
});

// Verify Firebase Google ID token via Google Identity Toolkit API and sync local session
router.post('/firebase-sync', authRateLimiter, async (req, res) => {
  const { idToken } = req.body as { idToken?: string };
  if (!idToken) return res.status(400).json({ error: 'Firebase ID token is required.' });

  let apiKey = process.env.FIREBASE_API_KEY || '';
  if (!apiKey) {
    try {
      const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      apiKey = cfg.apiKey || '';
    } catch {}
  }
  if (!apiKey) {
    return res.status(503).json({ error: 'Firebase configuration missing on server.' });
  }

  try {
    const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const verifyJson = (await verifyRes.json()) as any;
    const fbUser = verifyJson?.users?.[0];
    if (!verifyRes.ok || !fbUser?.email || !fbUser?.emailVerified) {
      return res.status(401).json({ error: 'Unable to verify Firebase Google session.' });
    }

    const email = String(fbUser.email).toLowerCase();
    const displayName = String(fbUser.displayName || email.split('@')[0]);

    let profile = db.prepare('SELECT id, is_active FROM profiles WHERE lower(email) = ?').get(email) as
      | { id: string; is_active: number }
      | undefined;

    if (!profile) {
      const userId = crypto.randomUUID();
      db.transaction(() => {
        db.prepare('INSERT INTO profiles (id, full_name, email) VALUES (?, ?, ?)').run(userId, displayName, email);
        // Never grant staff privileges on auto-created Google accounts
        db.prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)').run(crypto.randomUUID(), userId, 'customer');
        db.prepare('INSERT INTO wishlists (id, user_id) VALUES (?, ?)').run(crypto.randomUUID(), userId);
      })();
      profile = { id: userId, is_active: 1 };
    } else if (!profile.is_active) {
      return res.status(403).json({ error: 'Account is disabled.' });
    }

    mergeGuestCart(profile.id, req.guestToken);
    const token = setSessionCookie(req, res, profile.id);
    const user = getUserWithRoles(profile.id);
    return res.json({ user, token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Firebase authentication failed.' });
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(req, res);
  return res.json({ ok: true });
});

router.get('/me', (req, res) => {
  return res.json({ user: req.user || null });
});

router.patch('/profile', requireAuth, (req, res) => {
  const schema = z.object({
    full_name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().optional().or(z.literal('')),
    preferred_language: z.enum(['en', 'hi']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid profile update.' });
  }
  const { full_name, email, preferred_language } = parsed.data;
  db.prepare(
    `UPDATE profiles SET full_name = ?, email = COALESCE(NULLIF(?, ''), email), preferred_language = COALESCE(?, preferred_language), updated_at = datetime('now') WHERE id = ?`
  ).run(full_name, email || '', preferred_language || null, req.user!.id);

  return res.json({ user: getUserWithRoles(req.user!.id) });
});

router.post('/forgot-password', authRateLimiter, (req, res) => {
  const { identifier } = req.body as { identifier?: string };
  if (!identifier) return res.status(400).json({ error: 'Email or mobile number required.' });
  const norm = identifier.trim().toLowerCase();
  const profile = db
    .prepare('SELECT id, phone, email FROM profiles WHERE lower(email) = ? OR phone = ?')
    .get(norm, identifier.replace(/\s+/g, '')) as { id: string; phone: string | null; email: string | null } | undefined;

  if (profile) {
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 1000 * 60 * 30).toISOString();
    db.prepare('UPDATE profiles SET reset_token = ?, reset_expires_at = ? WHERE id = ?').run(resetCode, expires, profile.id);
    db.prepare(
      'INSERT INTO notifications (id, channel, recipient, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      'in_app',
      profile.phone || profile.email || profile.id,
      'Password Reset Code',
      `Password reset verification code requested: ${resetCode}`,
      'queued'
    );
  }
  return res.json({
    ok: true,
    message: 'If an account matches those details, a password reset code has been queued. Contact store WhatsApp support if you need immediate assistance.',
  });
});

router.post('/reset-password', authRateLimiter, (req, res) => {
  const schema = z.object({
    identifier: z.string().trim().min(3),
    reset_code: z.string().trim().min(4),
    new_password: z.string().min(6),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid reset request.' });

  const { identifier, reset_code, new_password } = parsed.data;
  const profile = db
    .prepare('SELECT id, reset_token, reset_expires_at FROM profiles WHERE lower(email) = ? OR phone = ?')
    .get(identifier.toLowerCase(), identifier.replace(/\s+/g, '')) as
    | { id: string; reset_token: string | null; reset_expires_at: string | null }
    | undefined;

  if (
    !profile ||
    !profile.reset_token ||
    profile.reset_token !== reset_code ||
    !profile.reset_expires_at ||
    new Date(profile.reset_expires_at).getTime() < Date.now()
  ) {
    return res.status(400).json({ error: 'Invalid or expired reset code.' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE profiles SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?').run(
    hash,
    profile.id
  );
  return res.json({ ok: true });
});

export default router;
