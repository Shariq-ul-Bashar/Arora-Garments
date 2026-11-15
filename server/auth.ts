import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from './db.ts';

const SESSION_COOKIE = 'ag_session';
const GUEST_COOKIE = 'ag_guest';

const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET !== 'REPLACE_WITH_LONG_RANDOM_HMAC_SECRET'
    ? process.env.SESSION_SECRET
    : crypto.createHash('sha256').update(process.cwd() + '_arora_garments_2026').digest('hex');

export interface AuthUser {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  preferred_language: 'en' | 'hi';
  roles: string[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser | null;
      guestToken?: string;
    }
  }
}

function isRequestHttps(req: Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (proto.includes('https')) return true;
  if ((process.env.APP_URL || '').startsWith('https://')) return true;
  return false;
}

function signPayload(payloadB64: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
}

export function createSessionToken(userId: string): string {
  const payload = {
    uid: userId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = signPayload(b64);
  return `${b64}.${sig}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token || !token.includes('.')) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const expected = signPayload(b64);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as { uid: string; exp: number };
    if (!parsed.uid || parsed.exp < Date.now()) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

export function setSessionCookie(req: Request, res: Response, userId: string): string {
  const token = createSessionToken(userId);
  const secure = isRequestHttps(req);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    path: '/',
  });
  return token;
}

export function clearSessionCookie(req: Request, res: Response) {
  const secure = isRequestHttps(req);
  res.clearCookie(SESSION_COOKIE, {
    path: '/',
    sameSite: secure ? 'none' : 'lax',
    secure,
  });
}

export function getUserWithRoles(userId: string): AuthUser | null {
  const profile = db
    .prepare('SELECT id, full_name, email, phone, preferred_language, is_active FROM profiles WHERE id = ?')
    .get(userId) as
    | { id: string; full_name: string; email: string | null; phone: string | null; preferred_language: 'en' | 'hi'; is_active: number }
    | undefined;
  if (!profile || !profile.is_active) return null;

  const roleRows = db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(userId) as Array<{ role: string }>;
  const roles = roleRows.map((r) => r.role);

  const staffRoles = roles.filter((r) => r !== 'customer');
  let permissions: string[] = [];
  if (staffRoles.length > 0) {
    const placeholders = staffRoles.map(() => '?').join(',');
    const permRows = db
      .prepare(`SELECT DISTINCT permission_key FROM admin_permissions WHERE role IN (${placeholders}) AND allowed = 1`)
      .all(...staffRoles) as Array<{ permission_key: string }>;
    permissions = permRows.map((p) => p.permission_key);
  }

  return {
    id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    preferred_language: profile.preferred_language,
    roles,
    permissions,
  };
}

export function attachAuthContext(req: Request, res: Response, next: NextFunction) {
  const authHeader = String(req.headers.authorization || '');
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : undefined;
  const cookieToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const uid = verifySessionToken(cookieToken) || verifySessionToken(bearerToken);
  req.user = uid ? getUserWithRoles(uid) : null;

  let guestToken = (req.cookies?.[GUEST_COOKIE] as string | undefined) || (req.headers['x-guest-token'] as string | undefined);
  if (!guestToken) {
    guestToken = crypto.randomUUID();
    const secure = isRequestHttps(req);
    res.cookie(GUEST_COOKIE, guestToken, {
      httpOnly: true,
      sameSite: secure ? 'none' : 'lax',
      secure,
      maxAge: 1000 * 60 * 60 * 24 * 30,
      path: '/',
    });
  }
  req.guestToken = guestToken;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function requireStaff(requiredPermission?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Administrator authentication required' });
    }
    const staffRoles = req.user.roles.filter((r) => ['owner', 'manager', 'order_staff', 'content_staff'].includes(r));
    if (staffRoles.length === 0) {
      return res.status(403).json({ error: 'Forbidden: Staff access required' });
    }
    if (requiredPermission && !req.user.roles.includes('owner') && !req.user.permissions.includes(requiredPermission)) {
      return res.status(403).json({ error: `Forbidden: Missing permission (${requiredPermission})` });
    }
    next();
  };
}

export function logAdminAction(
  admin: AuthUser | null | undefined,
  action: string,
  entityType: string,
  entityId?: string,
  details?: unknown
) {
  try {
    db.prepare(
      'INSERT INTO admin_activity_logs (id, admin_user_id, admin_name, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      admin?.id || null,
      admin?.full_name || 'System',
      action,
      entityType,
      entityId || null,
      details ? JSON.stringify(details) : null
    );
  } catch (err) {
    console.error('Failed to write admin activity log:', err);
  }
}

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again shortly.' },
});

export const checkoutRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 35,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many checkout requests. Please wait a moment.' },
});
