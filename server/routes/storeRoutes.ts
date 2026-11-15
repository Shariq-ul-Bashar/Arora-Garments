import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.ts';
import { checkoutRateLimiter, requireAuth } from '../auth.ts';
import { calculateOrderGst, type GstInvoiceSettings } from '../services/gst.ts';
import { streamInvoicePdf } from '../services/invoice.ts';

const router = Router();

function getSetting<T>(key: string, fallback: T): T {
  const row = db.prepare('SELECT value_json FROM website_settings WHERE key = ?').get(key) as { value_json: string } | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value_json) as T;
  } catch {
    return fallback;
  }
}

function hydrateProducts(rows: any[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => '?').join(',');

  const images = db
    .prepare(`SELECT * FROM product_images WHERE product_id IN (${ph}) ORDER BY sort_order ASC, is_primary DESC`)
    .all(...ids) as any[];

  const variants = db
    .prepare(
      `SELECT pv.*, COALESCE(i.quantity_available, 0) as quantity_available, COALESCE(i.low_stock_threshold, 5) as low_stock_threshold
       FROM product_variants pv
       LEFT JOIN inventory i ON i.variant_id = pv.id
       WHERE pv.product_id IN (${ph}) AND pv.is_active = 1
       ORDER BY pv.created_at ASC`
    )
    .all(...ids) as any[];

  return rows.map((p) => {
    const pImgs = images.filter((img) => img.product_id === p.id);
    const pVars = variants.filter((v) => v.product_id === p.id);
    const totalStock = pVars.reduce((acc, v) => acc + (v.quantity_available || 0), 0);
    const effectivePrice = p.discounted_price != null && p.discounted_price < p.regular_price ? p.discounted_price : p.regular_price;
    const discountPct =
      p.discounted_price != null && p.discounted_price < p.regular_price
        ? Math.round(((p.regular_price - p.discounted_price) / p.regular_price) * 100)
        : 0;
    return {
      ...p,
      tags: JSON.parse(p.tags_json || '[]'),
      images: pImgs,
      variants: pVars,
      total_stock: totalStock,
      effective_price: effectivePrice,
      discount_percentage: discountPct,
    };
  });
}

function getOrCreateCart(req: any): string {
  if (req.user) {
    const existing = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(req.user.id) as { id: string } | undefined;
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO carts (id, user_id) VALUES (?, ?)').run(id, req.user.id);
    return id;
  }
  const existing = db.prepare('SELECT id FROM carts WHERE guest_token = ?').get(req.guestToken) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO carts (id, guest_token) VALUES (?, ?)').run(id, req.guestToken);
  return id;
}

function getCartDetails(cartId: string) {
  const items = db
    .prepare(
      `SELECT ci.id as cart_item_id, ci.quantity, pv.id as variant_id, pv.sku, pv.size, pv.color, pv.color_hex, pv.price_override,
              p.id as product_id, p.title, p.slug, p.regular_price, p.discounted_price, p.gst_rate, p.department,
              COALESCE(i.quantity_available, 0) as quantity_available,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) as image_url
       FROM cart_items ci
       JOIN product_variants pv ON pv.id = ci.variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN inventory i ON i.variant_id = pv.id
       WHERE ci.cart_id = ?`
    )
    .all(cartId) as any[];

  const mapped = items.map((item) => {
    const base = item.discounted_price != null && item.discounted_price < item.regular_price ? item.discounted_price : item.regular_price;
    const unitPrice = item.price_override != null ? item.price_override : base;
    return {
      ...item,
      unit_price: unitPrice,
      line_total: unitPrice * item.quantity,
    };
  });

  const subtotal = mapped.reduce((sum, it) => sum + it.line_total, 0);
  const item_count = mapped.reduce((sum, it) => sum + it.quantity, 0);
  return { items: mapped, subtotal, item_count };
}

// 1. Storefront Bootstrap
router.get('/store/bootstrap', (_req, res) => {
  const business_info = getSetting('business_info', {});
  const invoice_settings = getSetting('invoice_settings', {});
  const branding = getSetting('branding', {
    main_logo_url: '',
    light_logo_url: '',
    dark_logo_url: '',
    favicon_url: '',
    logo_width: 160,
    logo_height: 40,
    logo_alignment: 'left',
  });
  const appearance = getSetting('appearance', {
    active_theme_id: 'modern-classic',
    custom_overrides: {},
  });
  const payment_settings = getSetting<any>('payment_settings', {
    cod_enabled: true,
    upi_whatsapp_enabled: true,
    upi_id: '',
    upi_payee_name: 'ARORA GARMENTS',
    upi_qr_url: '',
    upi_instructions: '',
  });
  const categories = db
    .prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC')
    .all();
  const collections = db
    .prepare('SELECT * FROM collections WHERE is_active = 1 ORDER BY sort_order ASC')
    .all();
  const homepage_sections = db
    .prepare('SELECT * FROM homepage_sections WHERE is_visible = 1 ORDER BY sort_order ASC')
    .all()
    .map((s: any) => ({ ...s, config: JSON.parse(s.config_json || '{}') }));
  const banners = db
    .prepare('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order ASC')
    .all();
  const shipping_methods = db
    .prepare('SELECT * FROM shipping_methods WHERE is_active = 1 ORDER BY sort_order ASC')
    .all();
  const serviceable_zones = db
    .prepare('SELECT * FROM serviceable_pincodes WHERE is_active = 1 ORDER BY COALESCE(radius_km, 25) ASC, pincode ASC')
    .all();

  return res.json({
    business_info,
    invoice_settings,
    branding,
    appearance,
    payment_settings: {
      cod_enabled: Boolean(payment_settings.cod_enabled ?? true),
      upi_whatsapp_enabled: Boolean(payment_settings.upi_whatsapp_enabled ?? true),
      upi_id: payment_settings.upi_id || '',
      upi_payee_name: payment_settings.upi_payee_name || 'ARORA GARMENTS',
      upi_qr_url: payment_settings.upi_qr_url || '',
      upi_instructions: payment_settings.upi_instructions || '',
    },
    categories,
    collections,
    homepage_sections,
    banners,
    shipping_methods,
    serviceable_zones,
    integrations: {
      cod_enabled: Boolean(payment_settings.cod_enabled ?? true),
      upi_whatsapp_enabled: Boolean(payment_settings.upi_whatsapp_enabled ?? true),
    },
  });
});

// 2. Product Catalog Search & Filtering
router.get('/products', (req, res) => {
  const {
    q,
    department,
    category,
    collection,
    size,
    color,
    minPrice,
    maxPrice,
    inStock,
    onDiscount,
    productType,
    sort = 'newest',
    featured,
    bestSeller,
    newArrival,
    trending,
    includeDrafts,
    limit = '40',
  } = req.query as Record<string, string>;

  const isStaff = req.user && req.user.roles.some((r) => ['owner', 'manager', 'order_staff', 'content_staff'].includes(r));
  const where: string[] =
    includeDrafts === 'true' && isStaff
      ? ['p.is_archived = 0']
      : ['p.is_published = 1', 'p.is_archived = 0'];
  const params: any[] = [];

  if (department && department !== 'all') {
    where.push('p.department = ?');
    params.push(department);
  }
  if (category) {
    where.push(
      `(p.category_id IN (SELECT id FROM categories WHERE slug = ?) OR p.subcategory_id IN (SELECT id FROM categories WHERE slug = ?))`
    );
    params.push(category, category);
  }
  if (collection) {
    where.push(
      `p.id IN (SELECT cp.product_id FROM collection_products cp JOIN collections c ON c.id = cp.collection_id WHERE c.slug = ?)`
    );
    params.push(collection);
  }
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    where.push(
      `(p.title LIKE ? OR p.description LIKE ? OR p.sku_prefix LIKE ? OR p.tags_json LIKE ? OR p.product_type LIKE ? OR EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.sku LIKE ?) OR EXISTS (SELECT 1 FROM categories c WHERE (c.id = p.category_id OR c.id = p.subcategory_id) AND c.name LIKE ?))`
    );
    params.push(like, like, like, like, like, like, like);
  }
  if (size) {
    where.push(`EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.size = ? AND pv.is_active = 1)`);
    params.push(size);
  }
  if (color) {
    where.push(`EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id AND pv.color = ? AND pv.is_active = 1)`);
    params.push(color);
  }
  if (minPrice) {
    where.push(`COALESCE(p.discounted_price, p.regular_price) >= ?`);
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    where.push(`COALESCE(p.discounted_price, p.regular_price) <= ?`);
    params.push(Number(maxPrice));
  }
  if (inStock === 'true') {
    where.push(
      `EXISTS (SELECT 1 FROM product_variants pv JOIN inventory i ON i.variant_id = pv.id WHERE pv.product_id = p.id AND i.quantity_available > 0)`
    );
  }
  if (onDiscount === 'true') {
    where.push(`p.discounted_price IS NOT NULL AND p.discounted_price < p.regular_price`);
  }
  if (productType) {
    where.push(`p.product_type = ?`);
    params.push(productType);
  }
  if (featured === 'true') where.push('p.is_featured = 1');
  if (bestSeller === 'true') where.push('p.is_best_seller = 1');
  if (newArrival === 'true') where.push('p.is_new_arrival = 1');
  if (trending === 'true') where.push('p.is_trending = 1');

  let orderBy = 'p.created_at DESC';
  if (sort === 'price_asc') orderBy = 'COALESCE(p.discounted_price, p.regular_price) ASC';
  else if (sort === 'price_desc') orderBy = 'COALESCE(p.discounted_price, p.regular_price) DESC';
  else if (sort === 'popularity' || sort === 'best_selling') orderBy = 'p.popularity_score DESC, p.created_at DESC';

  const sql = `
    SELECT p.*, c1.name as category_name, c2.name as subcategory_name, c2.slug as subcategory_slug
    FROM products p
    LEFT JOIN categories c1 ON c1.id = p.category_id
    LEFT JOIN categories c2 ON c2.id = p.subcategory_id
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ?
  `;
  params.push(Math.min(100, Math.max(1, Number(limit) || 40)));

  const rows = db.prepare(sql).all(...params) as any[];
  const products = hydrateProducts(rows);

  // Also return available facet options from published products
  const sizes = db
    .prepare(`SELECT DISTINCT pv.size FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE p.is_published = 1 AND p.is_archived = 0 AND pv.is_active = 1`)
    .all()
    .map((r: any) => r.size);
  const colors = db
    .prepare(`SELECT pv.color, MIN(pv.color_hex) as color_hex FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE p.is_published = 1 AND p.is_archived = 0 AND pv.is_active = 1 GROUP BY pv.color ORDER BY pv.color ASC`)
    .all();
  const productTypes = db
    .prepare(`SELECT DISTINCT product_type FROM products WHERE is_published = 1 AND is_archived = 0`)
    .all()
    .map((r: any) => r.product_type);

  return res.json({ products, facets: { sizes, colors, productTypes } });
});

// 3. Product Detail by Slug
router.get('/products/:slug', (req, res) => {
  const row = db
    .prepare(
      `SELECT p.*, c1.name as category_name, c1.slug as category_slug, c2.name as subcategory_name, c2.slug as subcategory_slug
       FROM products p
       LEFT JOIN categories c1 ON c1.id = p.category_id
       LEFT JOIN categories c2 ON c2.id = p.subcategory_id
       WHERE p.slug = ? AND p.is_published = 1 AND p.is_archived = 0`
    )
    .get(req.params.slug) as any;

  if (!row) return res.status(404).json({ error: 'Product not found' });

  const [product] = hydrateProducts([row]);
  const reviews = db
    .prepare(
      `SELECT id, user_id, reviewer_name, rating, comment, is_verified_purchase, admin_reply, created_at
       FROM reviews
       WHERE product_id = ? AND is_approved = 1
       ORDER BY created_at DESC`
    )
    .all(row.id);

  const relatedRows = db
    .prepare(
      `SELECT p.*, c1.name as category_name, c2.name as subcategory_name
       FROM products p
       LEFT JOIN categories c1 ON c1.id = p.category_id
       LEFT JOIN categories c2 ON c2.id = p.subcategory_id
       WHERE p.department = ? AND p.id != ? AND p.is_published = 1 AND p.is_archived = 0
       ORDER BY p.popularity_score DESC LIMIT 4`
    )
    .all(row.department, row.id) as any[];

  return res.json({ product, reviews, related: hydrateProducts(relatedRows) });
});

router.post('/products/:id/reviews', requireAuth, (req, res) => {
  const schema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(5, 'Please write at least 5 characters.').max(800),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Valid rating (1-5) and comment required.' });

  const prod = db.prepare('SELECT id FROM products WHERE id = ? AND is_archived = 0').get(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Product not found.' });

  const purchased = db
    .prepare(
      `SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.user_id = ? AND oi.product_id = ? AND o.order_status IN ('Delivered', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery') LIMIT 1`
    )
    .get(req.user!.id, req.params.id);

  const reviewId = crypto.randomUUID();
  try {
    db.prepare(
      'INSERT INTO reviews (id, product_id, user_id, reviewer_name, rating, comment, is_verified_purchase) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      reviewId,
      req.params.id,
      req.user!.id,
      req.user!.full_name,
      parsed.data.rating,
      parsed.data.comment,
      purchased ? 1 : 0
    );
    const created = db
      .prepare('SELECT id, user_id, reviewer_name, rating, comment, is_verified_purchase, admin_reply, created_at FROM reviews WHERE id = ?')
      .get(reviewId);
    return res.status(201).json({ ok: true, review: created });
  } catch {
    return res.status(409).json({ error: 'You have already reviewed this product. You can edit your existing review instead.' });
  }
});

router.put('/products/:id/reviews', requireAuth, (req, res) => {
  const schema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(5, 'Please write at least 5 characters.').max(800),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Valid rating (1-5) and comment required.' });

  const existing = db
    .prepare('SELECT id FROM reviews WHERE product_id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as { id: string } | undefined;

  if (!existing) {
    return res.status(404).json({ error: 'Existing review not found for this product.' });
  }

  db.prepare(
    `UPDATE reviews SET rating = ?, comment = ?, reviewer_name = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(parsed.data.rating, parsed.data.comment, req.user!.full_name, existing.id);

  const updated = db
    .prepare('SELECT id, user_id, reviewer_name, rating, comment, is_verified_purchase, admin_reply, created_at FROM reviews WHERE id = ?')
    .get(existing.id);
  return res.json({ ok: true, review: updated });
});

// 4. Privacy-conscious analytics events
router.post('/analytics/event', (req, res) => {
  const schema = z.object({
    event_type: z.enum(['product_view', 'add_to_cart', 'checkout_initiated', 'order_completed']),
    product_id: z.string().optional(),
    order_id: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid event' });
  db.prepare(
    'INSERT INTO analytics_events (id, event_type, product_id, order_id, session_id) VALUES (?, ?, ?, ?, ?)'
  ).run(
    crypto.randomUUID(),
    parsed.data.event_type,
    parsed.data.product_id || null,
    parsed.data.order_id || null,
    req.user?.id || req.guestToken || null
  );
  return res.json({ ok: true });
});

// 5. Pincode Serviceability Check
router.get('/pincodes/check/:pincode', (req, res) => {
  const pin = req.params.pincode.trim();
  const row = db
    .prepare('SELECT * FROM serviceable_pincodes WHERE pincode = ? AND is_active = 1')
    .get(pin) as any;
  if (!row) {
    return res.json({
      serviceable: false,
      pincode: pin,
      message: `Online website checkout is currently available for Bulandshahr and configured nearby PIN codes. PIN ${pin} is eligible for Pan-India ordering via WhatsApp enquiry.`,
    });
  }
  return res.json({ serviceable: true, details: row });
});

// 6. Cart Endpoints
router.get('/cart', (req, res) => {
  const cartId = getOrCreateCart(req);
  return res.json(getCartDetails(cartId));
});

router.post('/cart', (req, res) => {
  const schema = z.object({
    variant_id: z.string().min(1),
    quantity: z.number().int().min(1).max(20).default(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid cart item' });

  const { variant_id, quantity } = parsed.data;
  const stock = db
    .prepare(
      `SELECT i.quantity_available, pv.product_id FROM product_variants pv JOIN inventory i ON i.variant_id = pv.id WHERE pv.id = ? AND pv.is_active = 1`
    )
    .get(variant_id) as { quantity_available: number; product_id: string } | undefined;

  if (!stock || stock.quantity_available < quantity) {
    return res.status(400).json({ error: 'Requested size/colour variant is out of stock or insufficient quantity.' });
  }

  const cartId = getOrCreateCart(req);
  const existing = db
    .prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?')
    .get(cartId, variant_id) as { id: string; quantity: number } | undefined;

  if (existing) {
    const nextQty = existing.quantity + quantity;
    if (nextQty > stock.quantity_available) {
      return res.status(400).json({ error: `Only ${stock.quantity_available} unit(s) available in stock.` });
    }
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(nextQty, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (id, cart_id, variant_id, quantity) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      cartId,
      variant_id,
      quantity
    );
  }

  db.prepare('INSERT INTO analytics_events (id, event_type, product_id, session_id) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    'add_to_cart',
    stock.product_id,
    req.user?.id || req.guestToken || null
  );

  return res.json(getCartDetails(cartId));
});

router.patch('/cart/:variantId', (req, res) => {
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) {
    return res.status(400).json({ error: 'Invalid quantity' });
  }
  const cartId = getOrCreateCart(req);
  if (quantity === 0) {
    db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ?').run(cartId, req.params.variantId);
    return res.json(getCartDetails(cartId));
  }
  const stock = db
    .prepare('SELECT quantity_available FROM inventory WHERE variant_id = ?')
    .get(req.params.variantId) as { quantity_available: number } | undefined;
  if (!stock || quantity > stock.quantity_available) {
    return res.status(400).json({ error: `Only ${stock?.quantity_available || 0} unit(s) available.` });
  }
  db.prepare('UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND variant_id = ?').run(
    quantity,
    cartId,
    req.params.variantId
  );
  return res.json(getCartDetails(cartId));
});

router.delete('/cart/:variantId', (req, res) => {
  const cartId = getOrCreateCart(req);
  db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ?').run(cartId, req.params.variantId);
  return res.json(getCartDetails(cartId));
});

// Coupon validation
function computeCouponDiscount(code: string, subtotal: number) {
  const coupon = db
    .prepare('SELECT * FROM coupons WHERE upper(code) = upper(?) AND is_active = 1')
    .get(code.trim()) as any;
  if (!coupon) return { valid: false, error: 'Coupon code is invalid or inactive.', discount: 0 };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { valid: false, error: 'Coupon has expired.', discount: 0 };
  }
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    return { valid: false, error: 'Coupon usage limit has been reached.', discount: 0 };
  }
  if (subtotal < coupon.min_order_amount) {
    return { valid: false, error: `Minimum order of ₹${coupon.min_order_amount} required for this coupon.`, discount: 0 };
  }
  let discount =
    coupon.discount_type === 'percentage' ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
  if (coupon.max_discount_amount != null) {
    discount = Math.min(discount, coupon.max_discount_amount);
  }
  discount = Math.min(discount, subtotal);
  return { valid: true, coupon, discount: Math.round(discount * 100) / 100 };
}

router.post('/cart/apply-coupon', (req, res) => {
  const { code } = req.body as { code?: string };
  if (!code) return res.status(400).json({ error: 'Enter a coupon code.' });
  const cartId = getOrCreateCart(req);
  const { subtotal } = getCartDetails(cartId);
  const result = computeCouponDiscount(code, subtotal);
  if (!result.valid) return res.status(400).json({ error: result.error });
  return res.json({ valid: true, code: result.coupon.code, discount: result.discount });
});

// 7. Wishlist
router.get('/wishlist', requireAuth, (req, res) => {
  let wl = db.prepare('SELECT id FROM wishlists WHERE user_id = ?').get(req.user!.id) as { id: string } | undefined;
  if (!wl) {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO wishlists (id, user_id) VALUES (?, ?)').run(id, req.user!.id);
    wl = { id };
  }
  const rows = db
    .prepare(
      `SELECT p.*, c1.name as category_name, c2.name as subcategory_name
       FROM wishlist_items wi
       JOIN products p ON p.id = wi.product_id
       LEFT JOIN categories c1 ON c1.id = p.category_id
       LEFT JOIN categories c2 ON c2.id = p.subcategory_id
       WHERE wi.wishlist_id = ? AND p.is_published = 1 AND p.is_archived = 0`
    )
    .all(wl.id) as any[];
  return res.json({ products: hydrateProducts(rows) });
});

router.post('/wishlist/:productId', requireAuth, (req, res) => {
  let wl = db.prepare('SELECT id FROM wishlists WHERE user_id = ?').get(req.user!.id) as { id: string } | undefined;
  if (!wl) {
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO wishlists (id, user_id) VALUES (?, ?)').run(id, req.user!.id);
    wl = { id };
  }
  db.prepare('INSERT OR IGNORE INTO wishlist_items (wishlist_id, product_id) VALUES (?, ?)').run(wl.id, req.params.productId);
  return res.json({ ok: true });
});

router.delete('/wishlist/:productId', requireAuth, (req, res) => {
  const wl = db.prepare('SELECT id FROM wishlists WHERE user_id = ?').get(req.user!.id) as { id: string } | undefined;
  if (wl) {
    db.prepare('DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?').run(wl.id, req.params.productId);
  }
  return res.json({ ok: true });
});

// 8. Addresses
router.get('/addresses', requireAuth, (req, res) => {
  const addresses = db
    .prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC')
    .all(req.user!.id);
  return res.json({ addresses });
});

router.post('/addresses', requireAuth, (req, res) => {
  const schema = z.object({
    full_name: z.string().trim().min(2),
    mobile: z.string().trim().min(10).max(15),
    address_line: z.string().trim().min(4),
    locality: z.string().trim().min(2),
    city: z.string().trim().min(2),
    state: z.string().trim().min(2),
    pincode: z.string().trim().regex(/^\d{6}$/),
    is_default: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please fill all address fields with a valid 6-digit PIN code.' });

  const id = crypto.randomUUID();
  const d = parsed.data;
  db.transaction(() => {
    if (d.is_default) {
      db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user!.id);
    }
    db.prepare(
      'INSERT INTO addresses (id, user_id, full_name, mobile, address_line, locality, city, state, pincode, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, req.user!.id, d.full_name, d.mobile, d.address_line, d.locality, d.city, d.state, d.pincode, d.is_default ? 1 : 0);
  })();
  return res.status(201).json({ id });
});

router.delete('/addresses/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  return res.json({ ok: true });
});

// 9. Atomic Checkout (COD & UPI / Pay via WhatsApp — Cart or Buy Now)
const checkoutSchema = z.object({
  idempotency_key: z.string().min(8).max(100),
  mode: z.enum(['cart', 'buy_now']).default('cart'),
  buy_now_item: z
    .object({
      variant_id: z.string().min(1),
      quantity: z.number().int().min(1).max(20).default(1),
    })
    .optional(),
  customer_name: z.string().trim().min(2).max(100),
  customer_mobile: z.string().trim().min(10).max(15),
  customer_email: z.string().trim().email().optional().or(z.literal('')),
  address_line: z.string().trim().min(4).max(250),
  locality: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/),
  delivery_instructions: z.string().trim().max(300).optional(),
  shipping_method_id: z.string().optional(),
  coupon_code: z.string().trim().optional(),
  payment_method: z.enum(['COD', 'UPI_WHATSAPP']),
});

function buildWhatsAppPaymentMessage(params: {
  orderNumber: string;
  customerName: string;
  customerMobile: string;
  grandTotal: number;
  items: Array<{ title: string; size: string; color: string; quantity: number; line_total: number }>;
  addressLine: string;
  city: string;
  pincode: string;
}) {
  const lines = params.items
    .map((it) => `• ${it.title} (${it.size}, ${it.color}) × ${it.quantity} = ₹${it.line_total}`)
    .join('\n');
  return `Namaste ARORA GARMENTS,\n\nI have placed Order *${params.orderNumber}* via *UPI / Pay via WhatsApp*.\n\n*Items:*\n${lines}\n\n*Total Payable:* ₹${params.grandTotal}\n*Customer:* ${params.customerName} (${params.customerMobile})\n*Delivery Address:* ${params.addressLine}, ${params.city} - ${params.pincode}\n\nI am attaching my UPI payment screenshot / UTR reference here for manual verification by the store team.`;
}

router.post('/checkout/preview', (req, res) => {
  const { mode = 'cart', buy_now_item, pincode, shipping_method_id, coupon_code, state } = req.body as {
    mode?: 'cart' | 'buy_now';
    buy_now_item?: { variant_id: string; quantity: number };
    pincode?: string;
    shipping_method_id?: string;
    coupon_code?: string;
    state?: string;
  };

  let items: Array<{ title: string; quantity: number; line_total: number; gst_rate?: number | null }> = [];
  if (mode === 'buy_now' && buy_now_item?.variant_id) {
    const v = db
      .prepare(
        `SELECT pv.price_override, p.title, p.regular_price, p.discounted_price, p.gst_rate
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         WHERE pv.id = ? AND pv.is_active = 1`
      )
      .get(buy_now_item.variant_id) as any;
    if (v) {
      const base = v.discounted_price != null && v.discounted_price < v.regular_price ? v.discounted_price : v.regular_price;
      const unitPrice = v.price_override != null ? v.price_override : base;
      const qty = Math.max(1, Number(buy_now_item.quantity || 1));
      items = [{ title: v.title, quantity: qty, line_total: unitPrice * qty, gst_rate: v.gst_rate ?? null }];
    }
  } else {
    const cartId = getOrCreateCart(req);
    const cart = getCartDetails(cartId);
    items = cart.items.map((it: any) => ({
      title: it.title,
      quantity: it.quantity,
      line_total: it.line_total,
      gst_rate: it.gst_rate ?? null,
    }));
  }

  const subtotal = items.reduce((s, it) => s + it.line_total, 0);
  let discountAmount = 0;
  let couponError: string | null = null;
  if (coupon_code && coupon_code.trim()) {
    const cRes = computeCouponDiscount(coupon_code, subtotal);
    if (cRes.valid) discountAmount = cRes.discount;
    else couponError = cRes.error || null;
  }

  let shippingFee = 0;
  const pinRow = pincode
    ? (db.prepare('SELECT * FROM serviceable_pincodes WHERE pincode = ? AND is_active = 1').get(pincode.trim()) as any)
    : null;
  if (pinRow) {
    shippingFee = Number(pinRow.delivery_fee || 0);
    if (pinRow.free_delivery_above != null && subtotal - discountAmount >= pinRow.free_delivery_above) {
      shippingFee = 0;
    }
  }
  if (shipping_method_id) {
    const sm = db.prepare('SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1').get(shipping_method_id) as any;
    if (sm && sm.base_fee === 0) shippingFee = 0;
  }

  const invoiceSettings = getSetting<GstInvoiceSettings>('invoice_settings', {});
  const gst = calculateOrderGst({
    items,
    discountAmount,
    shippingFee,
    customerState: state || pinRow?.state || invoiceSettings.seller_state || 'Uttar Pradesh',
    invoiceSettings,
  });

  return res.json({
    subtotal: gst.subtotal,
    discount_amount: gst.discount_amount,
    shipping_fee: gst.shipping_fee,
    taxable_amount: gst.taxable_amount,
    cgst_amount: gst.cgst_amount,
    sgst_amount: gst.sgst_amount,
    igst_amount: gst.igst_amount,
    tax_amount: gst.tax_amount,
    grand_total: gst.grand_total,
    coupon_error: couponError,
    gst,
  });
});

router.post('/checkout', checkoutRateLimiter, async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid checkout fields.' });
  }
  const input = parsed.data;
  const paymentSettings = getSetting<any>('payment_settings', {
    cod_enabled: true,
    upi_whatsapp_enabled: true,
    upi_id: '',
    upi_payee_name: 'ARORA GARMENTS',
    upi_qr_url: '',
    upi_instructions: '',
  });
  const biz = getSetting<{ whatsapp_primary?: string }>('business_info', { whatsapp_primary: '919897694349' });
  const targetWa = (biz.whatsapp_primary || '919897694349').replace(/\D/g, '');

  // Duplicate order protection
  const duplicateOrder = db
    .prepare(
      'SELECT id, order_number, invoice_number, taxable_amount, cgst_amount, sgst_amount, igst_amount, tax_amount, gst_breakdown_json, grand_total, payment_method, payment_status, is_proforma FROM orders WHERE idempotency_key = ?'
    )
    .get(input.idempotency_key) as any;
  if (duplicateOrder) {
    const dupItems = db.prepare('SELECT product_title as title, size, color, quantity, line_total FROM order_items WHERE order_id = ?').all(duplicateOrder.id) as any[];
    const waMsg = buildWhatsAppPaymentMessage({
      orderNumber: duplicateOrder.order_number,
      customerName: input.customer_name,
      customerMobile: input.customer_mobile,
      grandTotal: duplicateOrder.grand_total,
      items: dupItems,
      addressLine: input.address_line,
      city: input.city,
      pincode: input.pincode,
    });
    return res.json({
      order: {
        ...duplicateOrder,
        gst_breakdown: duplicateOrder.gst_breakdown_json ? JSON.parse(duplicateOrder.gst_breakdown_json) : null,
      },
      duplicate: true,
      whatsapp_url: `https://wa.me/${targetWa}?text=${encodeURIComponent(waMsg)}`,
      payment_settings: paymentSettings,
    });
  }

  // Local Delivery PIN code check
  const pinRow = db
    .prepare('SELECT * FROM serviceable_pincodes WHERE pincode = ? AND is_active = 1')
    .get(input.pincode) as any;
  if (!pinRow) {
    return res.status(400).json({
      error: `PIN code ${input.pincode} is outside our local Bulandshahr & nearby delivery zones. Please use our Pan-India WhatsApp Order Enquiry.`,
      out_of_zone: true,
    });
  }
  if (input.payment_method === 'COD' && (!pinRow.cod_allowed || paymentSettings.cod_enabled === false)) {
    return res.status(400).json({ error: 'Cash on Delivery is currently unavailable for this PIN code.' });
  }
  if (input.payment_method === 'UPI_WHATSAPP' && paymentSettings.upi_whatsapp_enabled === false) {
    return res.status(400).json({ error: 'UPI / Pay via WhatsApp is currently disabled. Please choose Cash on Delivery.' });
  }

  let checkoutItems: Array<{
    variant_id: string;
    product_id: string;
    title: string;
    sku: string;
    size: string;
    color: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    gst_rate?: number | null;
  }> = [];
  let cartSubtotal = 0;
  let cartId: string | null = null;

  if (input.mode === 'buy_now') {
    if (!input.buy_now_item) {
      return res.status(400).json({ error: 'Select a product size and colour before using Buy Now.' });
    }
    const v = db
      .prepare(
        `SELECT pv.id as variant_id, pv.sku, pv.size, pv.color, pv.price_override,
                p.id as product_id, p.title, p.regular_price, p.discounted_price, p.gst_rate, p.is_published, p.is_archived,
                COALESCE(i.quantity_available, 0) as quantity_available
         FROM product_variants pv
         JOIN products p ON p.id = pv.product_id
         LEFT JOIN inventory i ON i.variant_id = pv.id
         WHERE pv.id = ? AND pv.is_active = 1`
      )
      .get(input.buy_now_item.variant_id) as any;

    if (!v || !v.is_published || v.is_archived) {
      return res.status(404).json({ error: 'Selected item is no longer available for purchase.' });
    }
    if (v.quantity_available < input.buy_now_item.quantity) {
      return res.status(400).json({ error: `Only ${v.quantity_available} unit(s) available in stock.` });
    }
    const base = v.discounted_price != null && v.discounted_price < v.regular_price ? v.discounted_price : v.regular_price;
    const unitPrice = v.price_override != null ? v.price_override : base;
    const lineTotal = unitPrice * input.buy_now_item.quantity;
    checkoutItems = [
      {
        variant_id: v.variant_id,
        product_id: v.product_id,
        title: v.title,
        sku: v.sku,
        size: v.size,
        color: v.color,
        quantity: input.buy_now_item.quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        gst_rate: v.gst_rate ?? null,
      },
    ];
    cartSubtotal = lineTotal;
  } else {
    cartId = getOrCreateCart(req);
    const cart = getCartDetails(cartId);
    if (cart.items.length === 0) {
      return res.status(400).json({ error: 'Your shopping cart is empty.' });
    }
    checkoutItems = cart.items;
    cartSubtotal = cart.subtotal;
  }

  if (pinRow.min_order_value && Number(pinRow.min_order_value) > 0 && cartSubtotal < Number(pinRow.min_order_value)) {
    return res.status(400).json({
      error: `Minimum order value for ${pinRow.town_name || pinRow.area_name} (${pinRow.pincode}) is ₹${pinRow.min_order_value}.`,
    });
  }

  // Compute server-side pricing
  let discountAmount = 0;
  let validCoupon: any = null;
  if (input.coupon_code) {
    const cRes = computeCouponDiscount(input.coupon_code, cartSubtotal);
    if (!cRes.valid) return res.status(400).json({ error: cRes.error });
    discountAmount = cRes.discount;
    validCoupon = cRes.coupon;
  }

  let shippingFee = Number(pinRow.delivery_fee || 0);
  if (pinRow.free_delivery_above != null && cartSubtotal - discountAmount >= pinRow.free_delivery_above) {
    shippingFee = 0;
  }
  if (input.shipping_method_id) {
    const sm = db.prepare('SELECT * FROM shipping_methods WHERE id = ? AND is_active = 1').get(input.shipping_method_id) as any;
    if (sm && sm.base_fee === 0) {
      shippingFee = 0; // Store pickup
    }
  }

  const invoiceSettings = getSetting<GstInvoiceSettings>('invoice_settings', {});
  const gstCalc = calculateOrderGst({
    items: checkoutItems.map((it) => ({
      title: it.title,
      quantity: it.quantity,
      line_total: it.line_total,
      gst_rate: it.gst_rate ?? null,
    })),
    discountAmount,
    shippingFee,
    customerState: input.state,
    invoiceSettings,
  });
  const taxAmount = gstCalc.tax_amount;
  const grandTotal = gstCalc.grand_total;

  const orderId = crypto.randomUUID();
  const shortNum = Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 89);
  const orderNumber = `AG-${shortNum}`;
  const invoiceNumber = `INV-AG-${shortNum}`;

  const paymentStatus = input.payment_method === 'UPI_WHATSAPP' ? 'awaiting_payment' : 'pending';
  const isProforma = 1; // Proforma until payment verified (UPI) or collected (COD)

  const addressObj = {
    address_line: input.address_line,
    locality: input.locality,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
  };

  try {
    db.transaction(() => {
      for (const item of checkoutItems) {
        const inv = db
          .prepare('SELECT quantity_available FROM inventory WHERE variant_id = ?')
          .get(item.variant_id) as { quantity_available: number } | undefined;
        if (!inv || inv.quantity_available < item.quantity) {
          throw new Error(`Insufficient stock for ${item.title} (${item.size} / ${item.color}). Available: ${inv?.quantity_available || 0}`);
        }
        const upd = db
          .prepare(
            `UPDATE inventory SET quantity_available = quantity_available - ?, updated_at = datetime('now') WHERE variant_id = ? AND quantity_available >= ?`
          )
          .run(item.quantity, item.variant_id, item.quantity);
        if (upd.changes === 0) {
          throw new Error(`Stock race conflict for ${item.title}. Please refresh and try again.`);
        }
        db.prepare(
          'INSERT INTO inventory_movements (id, variant_id, change_amount, reason, reference_id, note) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(crypto.randomUUID(), item.variant_id, -item.quantity, 'order_placed', orderNumber, `Website order ${orderNumber}`);
      }

      db.prepare(
        `INSERT INTO orders (
          id, order_number, invoice_number, idempotency_key, user_id,
          customer_name, customer_mobile, customer_email,
          shipping_address_json, billing_address_json, delivery_instructions,
          subtotal, discount_amount, shipping_fee, taxable_amount, cgst_amount, sgst_amount, igst_amount, tax_amount, gst_breakdown_json, grand_total, coupon_code,
          payment_method, payment_status, is_proforma, order_source, order_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Website', 'Pending Confirmation')`
      ).run(
        orderId,
        orderNumber,
        invoiceNumber,
        input.idempotency_key,
        req.user?.id || null,
        input.customer_name,
        input.customer_mobile,
        input.customer_email || null,
        JSON.stringify(addressObj),
        JSON.stringify(addressObj),
        input.delivery_instructions || null,
        cartSubtotal,
        discountAmount,
        shippingFee,
        gstCalc.taxable_amount,
        gstCalc.cgst_amount,
        gstCalc.sgst_amount,
        gstCalc.igst_amount,
        taxAmount,
        JSON.stringify(gstCalc),
        grandTotal,
        validCoupon ? validCoupon.code : null,
        input.payment_method,
        paymentStatus,
        isProforma
      );

      for (const item of checkoutItems) {
        db.prepare(
          'INSERT INTO order_items (id, order_id, product_id, variant_id, product_title, sku, size, color, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          crypto.randomUUID(),
          orderId,
          item.product_id,
          item.variant_id,
          item.title,
          item.sku,
          item.size,
          item.color,
          item.quantity,
          item.unit_price,
          item.line_total
        );
        db.prepare('UPDATE products SET popularity_score = popularity_score + ? WHERE id = ?').run(item.quantity, item.product_id);
      }

      const initNote =
        input.payment_method === 'UPI_WHATSAPP'
          ? 'Order created awaiting UPI payment & screenshot verification via WhatsApp'
          : 'Order placed via Cash on Delivery';
      db.prepare(
        'INSERT INTO order_status_history (id, order_id, status, note, changed_by_name) VALUES (?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), orderId, 'Pending Confirmation', initNote, input.customer_name);

      if (validCoupon) {
        db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(validCoupon.id);
        db.prepare(
          'INSERT INTO coupon_redemptions (id, coupon_id, order_id, user_id, discount_applied) VALUES (?, ?, ?, ?, ?)'
        ).run(crypto.randomUUID(), validCoupon.id, orderId, req.user?.id || null, discountAmount);
      }

      db.prepare('INSERT INTO payments (id, order_id, provider, amount, currency, status) VALUES (?, ?, ?, ?, ?, ?)').run(
        crypto.randomUUID(),
        orderId,
        input.payment_method,
        grandTotal,
        'INR',
        paymentStatus
      );

      if (input.mode === 'cart' && cartId) {
        db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
      }

      db.prepare('INSERT INTO analytics_events (id, event_type, order_id, session_id) VALUES (?, ?, ?, ?)').run(
        crypto.randomUUID(),
        'order_completed',
        orderId,
        req.user?.id || req.guestToken || null
      );
    })();
  } catch (err: any) {
    return res.status(409).json({ error: err.message || 'Unable to reserve inventory.' });
  }

  const waMessage = buildWhatsAppPaymentMessage({
    orderNumber,
    customerName: input.customer_name,
    customerMobile: input.customer_mobile,
    grandTotal,
    items: checkoutItems,
    addressLine: input.address_line,
    city: input.city,
    pincode: input.pincode,
  });

  return res.status(201).json({
    order: {
      id: orderId,
      order_number: orderNumber,
      invoice_number: invoiceNumber,
      taxable_amount: gstCalc.taxable_amount,
      cgst_amount: gstCalc.cgst_amount,
      sgst_amount: gstCalc.sgst_amount,
      igst_amount: gstCalc.igst_amount,
      tax_amount: taxAmount,
      gst_breakdown: gstCalc,
      grand_total: grandTotal,
      payment_method: input.payment_method,
      payment_status: paymentStatus,
      is_proforma: isProforma,
      customer_mobile: input.customer_mobile,
    },
    whatsapp_url: `https://wa.me/${targetWa}?text=${encodeURIComponent(waMessage)}`,
    payment_settings: paymentSettings,
  });
});

// Customer submits UTR / claims they sent UPI payment on WhatsApp (NEVER auto-marks paid!)
router.post('/orders/:orderNumber/claim-upi', (req, res) => {
  const schema = z.object({
    utr_reference: z.string().trim().max(100).optional(),
    note: z.string().trim().max(300).optional(),
    mobile: z.string().trim().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payment claim payload.' });

  const order = db
    .prepare('SELECT * FROM orders WHERE upper(order_number) = upper(?)')
    .get(req.params.orderNumber.trim()) as any;
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const isOwner = req.user && order.user_id === req.user.id;
  const isStaff = req.user && req.user.roles.some((r) => ['owner', 'manager', 'order_staff'].includes(r));
  const mobileQuery = parsed.data.mobile || '';
  const mobileMatch = mobileQuery && order.customer_mobile.replace(/\D/g, '').endsWith(mobileQuery.replace(/\D/g, '').slice(-10));
  if (!isOwner && !isStaff && !mobileMatch) {
    return res.status(403).json({ error: 'Please verify your mobile number to submit a payment reference.' });
  }

  if (order.payment_status === 'paid') {
    return res.json({ ok: true, payment_status: 'paid' });
  }

  const ref = parsed.data.utr_reference?.trim() || 'Sent via WhatsApp';
  const note = parsed.data.note?.trim() || 'Customer confirmed UPI screenshot shared on WhatsApp; pending manual verification.';

  db.transaction(() => {
    db.prepare(
      `UPDATE orders SET payment_status = 'payment_claimed', payment_reference = ?, payment_claim_note = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(ref, note, order.id);

    db.prepare(
      `UPDATE payments SET status = 'payment_claimed', raw_payload_json = ?, updated_at = datetime('now') WHERE order_id = ?`
    ).run(JSON.stringify({ utr_reference: ref, note, claimed_at: new Date().toISOString() }), order.id);

    db.prepare(
      'INSERT INTO order_status_history (id, order_id, status, note, changed_by_name) VALUES (?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), order.id, order.order_status, `Payment claimed by customer (Ref: ${ref}) — awaiting manual verification`, order.customer_name);
  })();

  return res.json({ ok: true, payment_status: 'payment_claimed', payment_reference: ref });
});

// 10. Pan-India WhatsApp Order Enquiry (never marked paid; waits for admin confirmation)
router.post('/whatsapp-enquiry', checkoutRateLimiter, (req, res) => {
  const schema = z.object({
    customer_name: z.string().trim().min(2),
    customer_mobile: z.string().trim().min(10).max(15),
    city: z.string().trim().min(2),
    state: z.string().trim().min(2),
    pincode: z.string().trim().min(6).max(6),
    address_line: z.string().trim().min(4),
    items: z
      .array(
        z.object({
          product_id: z.string().optional(),
          variant_id: z.string().optional(),
          product_title: z.string(),
          sku: z.string(),
          size: z.string(),
          color: z.string(),
          quantity: z.number().int().min(1),
          unit_price: z.number().min(0),
        })
      )
      .min(1),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please complete contact and item details.' });

  const d = parsed.data;
  const orderId = crypto.randomUUID();
  const shortNum = 'WA-' + Date.now().toString().slice(-6);
  const invoiceNum = `INV-${shortNum}`;
  const subtotal = d.items.reduce((s, it) => s + it.unit_price * it.quantity, 0);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO orders (
        id, order_number, invoice_number, user_id,
        customer_name, customer_mobile,
        shipping_address_json, billing_address_json, delivery_instructions,
        subtotal, discount_amount, shipping_fee, tax_amount, grand_total,
        payment_method, payment_status, order_source, order_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 'WHATSAPP_MANUAL', 'pending', 'WhatsApp', 'Pending Confirmation')`
    ).run(
      orderId,
      shortNum,
      invoiceNum,
      req.user?.id || null,
      d.customer_name,
      d.customer_mobile,
      JSON.stringify({ address_line: d.address_line, locality: '', city: d.city, state: d.state, pincode: d.pincode }),
      JSON.stringify({ address_line: d.address_line, locality: '', city: d.city, state: d.state, pincode: d.pincode }),
      d.notes || 'Pan-India WhatsApp Enquiry — Delivery charges subject to store confirmation',
      subtotal,
      subtotal
    );

    for (const it of d.items) {
      db.prepare(
        'INSERT INTO order_items (id, order_id, product_id, variant_id, product_title, sku, size, color, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        crypto.randomUUID(),
        orderId,
        it.product_id || null,
        it.variant_id || null,
        it.product_title,
        it.sku,
        it.size,
        it.color,
        it.quantity,
        it.unit_price,
        it.unit_price * it.quantity
      );
    }

    db.prepare(
      'INSERT INTO order_status_history (id, order_id, status, note, changed_by_name) VALUES (?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), orderId, 'Pending Confirmation', 'WhatsApp order enquiry submitted for admin availability & delivery confirmation', d.customer_name);
  })();

  const biz = getSetting<{ whatsapp_primary?: string }>('business_info', { whatsapp_primary: '919897694349' });
  const targetWa = biz.whatsapp_primary || '919897694349';
  const summaryLines = d.items.map((it) => `• ${it.product_title} (${it.size}, ${it.color}) x${it.quantity} — ₹${it.unit_price * it.quantity}`).join('\n');
  const waText = `Namaste Arora Garments,\nI would like to place a Pan-India Order Enquiry (${shortNum}):\n${summaryLines}\n\nName: ${d.customer_name}\nMobile: ${d.customer_mobile}\nAddress: ${d.address_line}, ${d.city}, ${d.state} - ${d.pincode}\n\nPlease confirm product availability & courier charges.`;

  return res.status(201).json({
    order_number: shortNum,
    whatsapp_url: `https://wa.me/${targetWa}?text=${encodeURIComponent(waText)}`,
  });
});

// 11. Order Tracking & Customer Orders
router.get('/orders/track', (req, res) => {
  const { orderNumber, mobile } = req.query as { orderNumber?: string; mobile?: string };
  if (!orderNumber) return res.status(400).json({ error: 'Order ID is required.' });

  const order = db
    .prepare('SELECT * FROM orders WHERE upper(order_number) = upper(?)')
    .get(orderNumber.trim()) as any;
  if (!order) return res.status(404).json({ error: 'Order not found. Please check your Order ID.' });

  const isOwnerOfOrder = req.user && order.user_id === req.user.id;
  const mobileMatches = mobile && order.customer_mobile.replace(/\D/g, '').endsWith(mobile.replace(/\D/g, '').slice(-10));
  const isStaff = req.user && req.user.roles.some((r) => ['owner', 'manager', 'order_staff'].includes(r));

  if (!isOwnerOfOrder && !mobileMatches && !isStaff) {
    return res.status(403).json({ error: 'Please provide the registered mobile number used for this order to view tracking details.' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const history = db.prepare('SELECT status, note, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(order.id);

  return res.json({
    order: {
      id: order.id,
      order_number: order.order_number,
      invoice_number: order.invoice_number,
      customer_name: order.customer_name,
      shipping_address: JSON.parse(order.shipping_address_json),
      subtotal: order.subtotal,
      discount_amount: order.discount_amount,
      shipping_fee: order.shipping_fee,
      taxable_amount: order.taxable_amount,
      cgst_amount: order.cgst_amount,
      sgst_amount: order.sgst_amount,
      igst_amount: order.igst_amount,
      tax_amount: order.tax_amount,
      gst_breakdown: order.gst_breakdown_json ? JSON.parse(order.gst_breakdown_json) : null,
      grand_total: order.grand_total,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      payment_reference: order.payment_reference,
      payment_claim_note: order.payment_claim_note,
      payment_verified_at: order.payment_verified_at,
      is_proforma: order.is_proforma,
      order_source: order.order_source,
      order_status: order.order_status,
      courier_partner: order.courier_partner,
      tracking_number: order.tracking_number,
      tracking_url: order.tracking_url,
      shipped_at: order.shipped_at,
      expected_delivery_date: order.expected_delivery_date,
      created_at: order.created_at,
      items,
      history,
    },
  });
});

router.get('/orders', requireAuth, (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user!.id) as any[];
  return res.json({
    orders: orders.map((o) => ({
      ...o,
      gst_breakdown: o.gst_breakdown_json ? JSON.parse(o.gst_breakdown_json) : null,
      shipping_address: JSON.parse(o.shipping_address_json),
      billing_address: JSON.parse(o.billing_address_json),
    })),
  });
});

router.get('/orders/:id', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(req.params.id, req.params.id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const isStaff = req.user!.roles.some((r) => ['owner', 'manager', 'order_staff'].includes(r));
  if (order.user_id !== req.user!.id && !isStaff) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const history = db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC').all(order.id);
  const returns = db.prepare('SELECT * FROM return_requests WHERE order_id = ? ORDER BY created_at DESC').all(order.id);
  return res.json({
    order: {
      ...order,
      gst_breakdown: order.gst_breakdown_json ? JSON.parse(order.gst_breakdown_json) : null,
      shipping_address: JSON.parse(order.shipping_address_json),
      billing_address: JSON.parse(order.billing_address_json),
      items,
      history,
      return_requests: returns,
    },
  });
});

router.post('/orders/:id/cancel', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!['Pending Confirmation', 'Confirmed', 'Processing'].includes(order.order_status)) {
    return res.status(400).json({ error: 'Order cannot be cancelled once packed or shipped.' });
  }

  db.transaction(() => {
    db.prepare(`UPDATE orders SET order_status = 'Cancellation Requested', updated_at = datetime('now') WHERE id = ?`).run(order.id);
    db.prepare(
      'INSERT INTO order_status_history (id, order_id, status, note, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      crypto.randomUUID(),
      order.id,
      'Cancellation Requested',
      req.body?.reason || 'Customer requested cancellation',
      req.user!.id,
      req.user!.full_name
    );
  })();
  return res.json({ ok: true });
});

router.post('/orders/:id/return', requireAuth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.order_status !== 'Delivered') {
    return res.status(400).json({ error: 'Returns can only be requested after delivery.' });
  }
  const invoiceSettings = getSetting<{ return_window_days?: number }>('invoice_settings', { return_window_days: 7 });
  const days = Number(invoiceSettings.return_window_days || 7);
  const ageDays = (Date.now() - new Date(order.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > days) {
    return res.status(400).json({ error: `Return window of ${days} days has elapsed.` });
  }
  const schema = z.object({ reason: z.string().trim().min(3), details: z.string().trim().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please specify a return reason.' });

  db.transaction(() => {
    db.prepare(
      'INSERT INTO return_requests (id, order_id, user_id, reason, details) VALUES (?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), order.id, req.user!.id, parsed.data.reason, parsed.data.details || null);
    db.prepare(`UPDATE orders SET order_status = 'Return Requested', updated_at = datetime('now') WHERE id = ?`).run(order.id);
    db.prepare(
      'INSERT INTO order_status_history (id, order_id, status, note, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(crypto.randomUUID(), order.id, 'Return Requested', parsed.data.reason, req.user!.id, req.user!.full_name);
  })();

  return res.status(201).json({ ok: true });
});

// Download Invoice PDF
router.get('/orders/:id/invoice.pdf', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(req.params.id, req.params.id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const isStaff = req.user && req.user.roles.some((r) => ['owner', 'manager', 'order_staff'].includes(r));
  const isOwner = req.user && order.user_id === req.user.id;
  const mobileQuery = typeof req.query.mobile === 'string' ? req.query.mobile : '';
  const mobileMatch = mobileQuery && order.customer_mobile.replace(/\D/g, '').endsWith(mobileQuery.replace(/\D/g, '').slice(-10));

  if (!isStaff && !isOwner && !mobileMatch) {
    return res.status(403).json({ error: 'Unauthorized to download this invoice.' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as any[];
  const biz = getSetting<any>('business_info', {});
  const inv = getSetting<any>('invoice_settings', {});
  const branding = getSetting<any>('branding', {});

  streamInvoicePdf(
    res,
    {
      ...order,
      shipping_address: JSON.parse(order.shipping_address_json),
      billing_address: JSON.parse(order.billing_address_json),
      items,
    },
    { ...biz, ...inv, logo_url: branding.main_logo_url || branding.dark_logo_url || '' }
  );
});

// 12. Newsletter & Contact Form
router.post('/newsletter', (req, res) => {
  const emailOrPhone = String(req.body?.contact || '').trim();
  if (!emailOrPhone || emailOrPhone.length < 5) {
    return res.status(400).json({ error: 'Enter a valid email or WhatsApp number.' });
  }
  db.prepare('INSERT INTO notifications (id, channel, recipient, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(),
    'newsletter',
    emailOrPhone,
    'Newsletter Subscription',
    `Subscribed: ${emailOrPhone}`,
    'read'
  );
  return res.json({ ok: true });
});

router.post('/contact', (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2),
    phone: z.string().trim().min(10),
    message: z.string().trim().min(5).max(1000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Please fill name, phone, and message.' });
  db.prepare('INSERT INTO notifications (id, channel, recipient, subject, message, status) VALUES (?, ?, ?, ?, ?, ?)').run(
    crypto.randomUUID(),
    'contact_form',
    parsed.data.phone,
    `Contact from ${parsed.data.name}`,
    parsed.data.message,
    'queued'
  );
  return res.json({ ok: true });
});

export default router;
