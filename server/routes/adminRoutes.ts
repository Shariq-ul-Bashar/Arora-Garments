import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { db } from '../db.ts';
import { logAdminAction, requireStaff } from '../auth.ts';
import { calculateOrderGst, type GstInvoiceSettings } from '../services/gst.ts';
import { sendWhatsAppNotification } from '../services/whatsapp.ts';

const router = Router();

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `ag_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/svg+xml',
      'image/x-icon',
      'image/vnd.microsoft.icon',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP, AVIF, SVG, and ICO images under 5MB are allowed.'));
    }
  },
});

async function maybeUploadToSupabase(localPath: string, filename: string, mimeType: string, bucket = 'product-images'): Promise<string | null> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || url.includes('your-project') || key.includes('YOUR_SUPABASE') || key.includes('MY_SUPABASE')) return null;
  try {
    const supabase = createClient(url, key);
    const buf = fs.readFileSync(localPath);
    const { error } = await supabase.storage.from(bucket).upload(filename, buf, { contentType: mimeType, upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
    return data?.publicUrl || null;
  } catch {
    return null;
  }
}

// 1. Upload Image (products, logos, favicons, banners, UPI QR) + Storage Stats
router.post(
  '/upload',
  requireStaff(),
  (req, res, next) => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Image is too large. Please choose a photo under 5 MB.' });
        }
        return res.status(400).json({ error: err.message || 'Could not process this image file.' });
      }
      next();
    });
  },
  async (req, res) => {
    const perms = req.user?.permissions || [];
    const canUpload =
      perms.includes('manage_products') ||
      perms.includes('manage_cms') ||
      perms.includes('manage_settings') ||
      perms.includes('manage_categories');
    if (!canUpload) {
      return res.status(403).json({ error: 'Permission denied for media upload.' });
    }
    if (!req.file) return res.status(400).json({ error: 'No image file provided.' });
    const bucket = (req.body?.bucket as string) || 'product-images';
    const supaUrl = await maybeUploadToSupabase(req.file.path, req.file.filename, req.file.mimetype, bucket);
    const publicUrl = supaUrl || `/uploads/${req.file.filename}`;
    logAdminAction(req.user, 'upload_image', 'storage', req.file.filename, { size: req.file.size, url: publicUrl });
    return res.status(201).json({
      url: publicUrl,
      size_bytes: req.file.size,
      filename: req.file.filename,
      storage_backend: supaUrl ? 'supabase' : 'local',
    });
  }
);

router.get('/storage', requireStaff(), (_req, res) => {
  const files = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
  let totalBytes = 0;
  for (const f of files) {
    try {
      totalBytes += fs.statSync(path.join(uploadDir, f)).size;
    } catch {}
  }
  const imageCount = (db.prepare('SELECT COUNT(*) as c FROM product_images').get() as { c: number }).c;
  return res.json({
    uploaded_files: files.length,
    product_images_count: imageCount,
    total_bytes: totalBytes,
    total_mb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
  });
});

// 2. Overview & Analytics (Real DB Queries + Continuous Time-Series)
function buildContinuousDateSeries(
  rows: Array<{ day: string; orders: number; revenue: number }>,
  startDate?: string,
  endDate?: string
) {
  const map = new Map<string, { orders: number; revenue: number }>();
  for (const r of rows) {
    map.set(r.day, { orders: Number(r.orders || 0), revenue: Number(r.revenue || 0) });
  }

  let end = endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? new Date(`${endDate}T00:00:00Z`) : new Date();
  let start = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? new Date(`${startDate}T00:00:00Z`) : new Date(end.getTime() - 29 * 86400000);
  if (Number.isNaN(end.getTime())) end = new Date();
  if (Number.isNaN(start.getTime()) || start > end) start = new Date(end.getTime() - 29 * 86400000);

  // Cap series window to 90 days for fast chart rendering
  const maxSpanMs = 89 * 86400000;
  if (end.getTime() - start.getTime() > maxSpanMs) {
    start = new Date(end.getTime() - maxSpanMs);
  }

  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  const out: Array<{ day: string; label: string; orders: number; revenue: number }> = [];
  for (let ts = startUtc; ts <= endUtc; ts += 86400000) {
    const d = new Date(ts);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const entry = map.get(iso);
    out.push({
      day: iso,
      label,
      orders: entry ? entry.orders : 0,
      revenue: entry ? Math.round(entry.revenue * 100) / 100 : 0,
    });
  }
  return out;
}

router.get('/overview', requireStaff(), (req, res) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const hasRange = Boolean(startDate && endDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate));
  const dateFilter = hasRange ? `AND date(created_at) BETWEEN date(?) AND date(?)` : '';
  const orderDateFilter = hasRange ? `AND date(o.created_at) BETWEEN date(?) AND date(?)` : '';
  const dateParams = hasRange ? [startDate!, endDate!] : [];

  const totals = db
    .prepare(
      `SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(CASE WHEN order_status NOT IN ('Cancelled', 'Refunded') THEN grand_total ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(subtotal), 0) as gross_sales,
        COALESCE(SUM(CASE WHEN order_status NOT IN ('Cancelled', 'Refunded', 'Returned') THEN grand_total ELSE 0 END), 0) as net_sales,
        COALESCE(SUM(CASE WHEN date(created_at) = date('now') AND order_status != 'Cancelled' THEN grand_total ELSE 0 END), 0) as today_sales,
        COALESCE(SUM(CASE WHEN date(created_at) >= date('now', '-7 days') AND order_status != 'Cancelled' THEN grand_total ELSE 0 END), 0) as weekly_sales,
        COALESCE(SUM(CASE WHEN date(created_at) >= date('now', '-30 days') AND order_status != 'Cancelled' THEN grand_total ELSE 0 END), 0) as monthly_sales,
        SUM(CASE WHEN order_status = 'Pending Confirmation' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN order_status IN ('Confirmed', 'Processing', 'Packed') THEN 1 ELSE 0 END) as processing_orders,
        SUM(CASE WHEN order_status IN ('Shipped', 'Out for Delivery') THEN 1 ELSE 0 END) as shipped_orders,
        SUM(CASE WHEN order_status = 'Delivered' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN order_status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        SUM(CASE WHEN order_status IN ('Returned', 'Refunded') THEN 1 ELSE 0 END) as returned_orders,
        SUM(CASE WHEN payment_method = 'COD' THEN 1 ELSE 0 END) as cod_orders,
        SUM(CASE WHEN payment_method IN ('UPI_WHATSAPP', 'RAZORPAY') THEN 1 ELSE 0 END) as online_orders,
        SUM(CASE WHEN payment_method = 'UPI_WHATSAPP' AND payment_status IN ('awaiting_payment', 'payment_claimed', 'under_verification') THEN 1 ELSE 0 END) as pending_upi_verifications
       FROM orders WHERE 1=1 ${dateFilter}`
    )
    .get(...dateParams) as any;

  const totalProducts = (db.prepare('SELECT COUNT(*) as c FROM products WHERE is_archived = 0').get() as { c: number }).c;
  const draftProducts = (
    db.prepare(`SELECT COUNT(*) as c FROM products WHERE is_archived = 0 AND (is_published = 0 OR review_status = 'draft_needs_review')`).get() as { c: number }
  ).c;
  const totalCustomers = (
    db.prepare(`SELECT COUNT(DISTINCT user_id) as c FROM user_roles WHERE role = 'customer'`).get() as { c: number }
  ).c;

  const lowStock = db
    .prepare(
      `SELECT pv.id as variant_id, pv.sku, pv.size, pv.color, p.title, p.slug, i.quantity_available, i.low_stock_threshold
       FROM inventory i
       JOIN product_variants pv ON pv.id = i.variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE p.is_archived = 0 AND i.quantity_available <= i.low_stock_threshold
       ORDER BY i.quantity_available ASC LIMIT 20`
    )
    .all();

  const recentOrders = db
    .prepare('SELECT id, order_number, customer_name, customer_mobile, grand_total, payment_method, payment_status, order_source, order_status, created_at FROM orders ORDER BY created_at DESC LIMIT 12')
    .all();

  const rawSalesByDay = (hasRange
    ? db
        .prepare(
          `SELECT date(created_at) as day, COUNT(*) as orders, COALESCE(SUM(CASE WHEN order_status NOT IN ('Cancelled', 'Refunded') THEN grand_total ELSE 0 END), 0) as revenue
           FROM orders
           WHERE date(created_at) BETWEEN date(?) AND date(?)
           GROUP BY date(created_at)
           ORDER BY day ASC`
        )
        .all(startDate!, endDate!)
    : db
        .prepare(
          `SELECT date(created_at) as day, COUNT(*) as orders, COALESCE(SUM(CASE WHEN order_status NOT IN ('Cancelled', 'Refunded') THEN grand_total ELSE 0 END), 0) as revenue
           FROM orders
           WHERE date(created_at) >= date('now', '-30 days')
           GROUP BY date(created_at)
           ORDER BY day ASC`
        )
        .all()) as Array<{ day: string; orders: number; revenue: number }>;

  const salesByDay = buildContinuousDateSeries(rawSalesByDay, startDate, endDate);

  const bestSelling = db
    .prepare(
      `SELECT oi.product_title, oi.product_id, SUM(oi.quantity) as units_sold, SUM(oi.line_total) as revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.order_status NOT IN ('Cancelled', 'Refunded') ${orderDateFilter}
       GROUP BY oi.product_id, oi.product_title
       ORDER BY units_sold DESC LIMIT 8`
    )
    .all(...dateParams);

  const deptRevenue = db
    .prepare(
      `SELECT COALESCE(p.department, 'other') as department, COALESCE(SUM(oi.line_total), 0) as revenue, COALESCE(SUM(oi.quantity), 0) as units
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.order_status NOT IN ('Cancelled', 'Refunded') ${orderDateFilter}
       GROUP BY p.department`
    )
    .all(...dateParams);

  const funnel = db
    .prepare(
      `SELECT event_type, COUNT(*) as count FROM analytics_events WHERE 1=1 ${dateFilter} GROUP BY event_type`
    )
    .all(...dateParams) as Array<{ event_type: string; count: number }>;

  const reviewSummary = db
    .prepare(
      `SELECT
         COUNT(*) as total_reviews,
         SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved_reviews,
         SUM(CASE WHEN is_approved = 0 THEN 1 ELSE 0 END) as hidden_reviews,
         COALESCE(AVG(CASE WHEN is_approved = 1 THEN rating END), 0) as average_rating
       FROM reviews`
    )
    .get() as any;

  const recentReviews = db
    .prepare(
      `SELECT r.id, r.product_id, r.reviewer_name, r.rating, r.comment, r.is_verified_purchase, r.is_approved, r.admin_reply, r.created_at,
              p.title as product_title, p.slug as product_slug
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       ORDER BY r.created_at DESC LIMIT 5`
    )
    .all();

  const aov = totals.total_orders > 0 ? totals.total_revenue / totals.total_orders : 0;

  return res.json({
    kpis: {
      ...totals,
      average_order_value: Math.round(aov * 100) / 100,
      total_products: totalProducts,
      draft_products: draftProducts,
      total_customers: totalCustomers,
    },
    low_stock: lowStock,
    recent_orders: recentOrders,
    sales_by_day: salesByDay,
    best_selling: bestSelling,
    department_revenue: deptRevenue,
    analytics_funnel: funnel,
    review_summary: {
      total_reviews: Number(reviewSummary?.total_reviews || 0),
      approved_reviews: Number(reviewSummary?.approved_reviews || 0),
      hidden_reviews: Number(reviewSummary?.hidden_reviews || 0),
      average_rating: Math.round(Number(reviewSummary?.average_rating || 0) * 10) / 10,
    },
    recent_reviews: recentReviews,
  });
});

router.get('/analytics/export', requireStaff('view_analytics'), (_req, res) => {
  const rows = db
    .prepare('SELECT order_number, invoice_number, customer_name, customer_mobile, subtotal, discount_amount, shipping_fee, tax_amount, grand_total, payment_method, payment_status, order_source, order_status, created_at FROM orders ORDER BY created_at DESC')
    .all() as any[];
  const headers = ['Order Number', 'Invoice', 'Customer', 'Mobile', 'Subtotal', 'Discount', 'Shipping', 'Tax', 'Grand Total', 'Payment Method', 'Payment Status', 'Source', 'Status', 'Created At'];
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.order_number,
        r.invoice_number,
        `"${String(r.customer_name).replace(/"/g, '""')}"`,
        r.customer_mobile,
        r.subtotal,
        r.discount_amount,
        r.shipping_fee,
        r.tax_amount,
        r.grand_total,
        r.payment_method,
        r.payment_status,
        r.order_source,
        r.order_status,
        r.created_at,
      ].join(',')
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="arora-garments-sales-report.csv"');
  return res.send(csv);
});

// 3. Products Management
router.get('/products', requireStaff(), (_req, res) => {
  const products = db
    .prepare(
      `SELECT p.*, c1.name as category_name, c2.name as subcategory_name
       FROM products p
       LEFT JOIN categories c1 ON c1.id = p.category_id
       LEFT JOIN categories c2 ON c2.id = p.subcategory_id
       ORDER BY p.created_at DESC`
    )
    .all() as any[];

  const hydrated = products.map((p) => {
    const images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC').all(p.id);
    const variants = db
      .prepare(
        `SELECT pv.*, COALESCE(i.quantity_available, 0) as quantity_available, COALESCE(i.low_stock_threshold, 5) as low_stock_threshold
         FROM product_variants pv LEFT JOIN inventory i ON i.variant_id = pv.id WHERE pv.product_id = ?`
      )
      .all(p.id);
    return { ...p, tags: JSON.parse(p.tags_json || '[]'), images, variants };
  });
  return res.json({ products: hydrated });
});

function slugifyTitle(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `item-${Date.now().toString().slice(-5)}`;
}

function makeSkuPrefix(dept: string): string {
  const map: Record<string, string> = {
    'mens-wear': 'AG-M',
    'womens-wear': 'AG-W',
    'kids-wear': 'AG-K',
    footwear: 'AG-F',
  };
  return `${map[dept] || 'AG-P'}-${Date.now().toString().slice(-4)}`;
}

const productPayloadSchema = z.object({
  title: z.string().trim().min(2, 'Product name must be at least 2 characters.'),
  title_hi: z.string().optional(),
  slug: z.string().trim().optional().default(''),
  sku_prefix: z.string().trim().optional().default(''),
  description: z.string().trim().min(2, 'Please add a short product description.'),
  fabric_care: z.string().optional(),
  department: z.enum(['mens-wear', 'womens-wear', 'kids-wear', 'footwear']),
  category_id: z.string().nullable().optional(),
  subcategory_id: z.string().nullable().optional(),
  regular_price: z.number().min(0),
  discounted_price: z.number().min(0).nullable().optional(),
  gst_rate: z.number().min(0).max(28).nullable().optional(),
  product_type: z.string().default('Apparel'),
  tags: z.array(z.string()).default([]),
  is_featured: z.boolean().default(false),
  is_best_seller: z.boolean().default(false),
  is_new_arrival: z.boolean().default(false),
  is_trending: z.boolean().default(false),
  is_published: z.boolean().default(true),
  review_status: z.enum(['approved', 'draft_needs_review']).optional(),
  images: z
    .array(
      z.object({
        image_url: z.string().min(1),
        alt_text: z.string().default(''),
        is_primary: z.boolean().default(false),
      })
    )
    .default([]),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        sku: z.string().optional().default(''),
        size: z.string().min(1),
        color: z.string().min(1),
        color_hex: z.string().default('#141413'),
        price_override: z.number().nullable().optional(),
        quantity_available: z.number().int().min(0).default(0),
        low_stock_threshold: z.number().int().min(0).default(5),
      })
    )
    .min(1, 'Add at least one size and colour option.'),
});

router.post('/products', requireStaff('manage_products'), (req, res) => {
  const parsed = productPayloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product data' });
  const d = parsed.data;
  const prodId = crypto.randomUUID();
  const baseSlug = d.slug?.trim() || slugifyTitle(d.title);
  const slugExists = db.prepare('SELECT id FROM products WHERE slug = ?').get(baseSlug);
  const finalSlug = slugExists ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;
  const baseSkuPrefix = (d.sku_prefix?.trim() || makeSkuPrefix(d.department)).toUpperCase();
  const prefixExists = db.prepare('SELECT id FROM products WHERE sku_prefix = ?').get(baseSkuPrefix);
  const finalSkuPrefix = prefixExists ? `${baseSkuPrefix}-${Math.floor(10 + Math.random() * 89)}` : baseSkuPrefix;

  try {
    db.transaction(() => {
      db.prepare(
        `INSERT INTO products (
          id, title, title_hi, slug, sku_prefix, description, fabric_care, department,
          category_id, subcategory_id, regular_price, discounted_price, gst_rate, product_type, tags_json,
          is_featured, is_best_seller, is_new_arrival, is_trending, is_published, review_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        prodId,
        d.title,
        d.title_hi || null,
        finalSlug,
        finalSkuPrefix,
        d.description,
        d.fabric_care || null,
        d.department,
        d.category_id || null,
        d.subcategory_id || null,
        d.regular_price,
        d.discounted_price ?? null,
        d.gst_rate ?? null,
        d.product_type,
        JSON.stringify(d.tags),
        d.is_featured ? 1 : 0,
        d.is_best_seller ? 1 : 0,
        d.is_new_arrival ? 1 : 0,
        d.is_trending ? 1 : 0,
        d.is_published ? 1 : 0,
        d.is_published ? 'approved' : d.review_status || 'draft_needs_review'
      );

      d.images.forEach((img, i) => {
        db.prepare('INSERT INTO product_images (id, product_id, image_url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, ?, ?)').run(
          crypto.randomUUID(),
          prodId,
          img.image_url,
          img.alt_text || d.title,
          i,
          img.is_primary || i === 0 ? 1 : 0
        );
      });

      d.variants.forEach((v, idx) => {
        const vId = crypto.randomUUID();
        const autoSku = `${finalSkuPrefix}-${v.size.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${v.color.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'CLR'}-${idx + 1}`;
        const finalSku = v.sku?.trim() || autoSku;
        db.prepare('INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, price_override) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          vId,
          prodId,
          finalSku,
          v.size,
          v.color,
          v.color_hex,
          v.price_override ?? null
        );
        db.prepare('INSERT INTO inventory (variant_id, quantity_available, low_stock_threshold) VALUES (?, ?, ?)').run(
          vId,
          v.quantity_available,
          v.low_stock_threshold
        );
        db.prepare('INSERT INTO inventory_movements (id, variant_id, change_amount, reason, note, performed_by) VALUES (?, ?, ?, ?, ?, ?)').run(
          crypto.randomUUID(),
          vId,
          v.quantity_available,
          'initial_stock',
          'Product created in Admin',
          req.user!.id
        );
      });
    })();
    logAdminAction(req.user, 'create_product', 'product', prodId, { title: d.title });
    return res.status(201).json({ id: prodId, slug: finalSlug, sku_prefix: finalSkuPrefix });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create product (check unique slug/SKU).' });
  }
});

router.put('/products/:id', requireStaff('manage_products'), (req, res) => {
  const parsed = productPayloadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid product update' });
  const d = parsed.data;
  const prodId = req.params.id;
  const existingProd = db.prepare('SELECT slug, sku_prefix FROM products WHERE id = ?').get(prodId) as { slug: string; sku_prefix: string } | undefined;
  const finalSlug = d.slug?.trim() || existingProd?.slug || slugifyTitle(d.title);
  const finalSkuPrefix = (d.sku_prefix?.trim() || existingProd?.sku_prefix || makeSkuPrefix(d.department)).toUpperCase();

  try {
    db.transaction(() => {
      db.prepare(
        `UPDATE products SET
          title = ?, title_hi = ?, slug = ?, sku_prefix = ?, description = ?, fabric_care = ?,
          department = ?, category_id = ?, subcategory_id = ?, regular_price = ?, discounted_price = ?, gst_rate = ?,
          product_type = ?, tags_json = ?, is_featured = ?, is_best_seller = ?, is_new_arrival = ?,
          is_trending = ?, is_published = ?, review_status = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        d.title,
        d.title_hi || null,
        finalSlug,
        finalSkuPrefix,
        d.description,
        d.fabric_care || null,
        d.department,
        d.category_id || null,
        d.subcategory_id || null,
        d.regular_price,
        d.discounted_price ?? null,
        d.gst_rate ?? null,
        d.product_type,
        JSON.stringify(d.tags),
        d.is_featured ? 1 : 0,
        d.is_best_seller ? 1 : 0,
        d.is_new_arrival ? 1 : 0,
        d.is_trending ? 1 : 0,
        d.is_published ? 1 : 0,
        d.is_published ? 'approved' : d.review_status || 'draft_needs_review',
        prodId
      );

      db.prepare('DELETE FROM product_images WHERE product_id = ?').run(prodId);
      d.images.forEach((img, i) => {
        db.prepare('INSERT INTO product_images (id, product_id, image_url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, ?, ?)').run(
          crypto.randomUUID(),
          prodId,
          img.image_url,
          img.alt_text || d.title,
          i,
          img.is_primary || i === 0 ? 1 : 0
        );
      });

      const existingVars = db.prepare('SELECT id FROM product_variants WHERE product_id = ?').all(prodId) as Array<{ id: string }>;
      const incomingIds = new Set(d.variants.map((v) => v.id).filter(Boolean));
      for (const ev of existingVars) {
        if (!incomingIds.has(ev.id)) {
          db.prepare('UPDATE product_variants SET is_active = 0 WHERE id = ?').run(ev.id);
        }
      }

      for (let vIdx = 0; vIdx < d.variants.length; vIdx++) {
        const v = d.variants[vIdx];
        const fallbackSku = `${finalSkuPrefix}-${v.size.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}-${v.color.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'CLR'}-${vIdx + 1}`;
        const finalSku = v.sku?.trim() || fallbackSku;
        if (v.id) {
          db.prepare(
            'UPDATE product_variants SET sku = ?, size = ?, color = ?, color_hex = ?, price_override = ?, is_active = 1 WHERE id = ? AND product_id = ?'
          ).run(finalSku, v.size, v.color, v.color_hex, v.price_override ?? null, v.id, prodId);
          const curInv = db.prepare('SELECT quantity_available FROM inventory WHERE variant_id = ?').get(v.id) as { quantity_available: number } | undefined;
          const diff = v.quantity_available - (curInv?.quantity_available ?? 0);
          db.prepare('UPDATE inventory SET quantity_available = ?, low_stock_threshold = ?, updated_at = datetime(\'now\') WHERE variant_id = ?').run(
            v.quantity_available,
            v.low_stock_threshold,
            v.id
          );
          if (diff !== 0) {
            db.prepare('INSERT INTO inventory_movements (id, variant_id, change_amount, reason, note, performed_by) VALUES (?, ?, ?, ?, ?, ?)').run(
              crypto.randomUUID(),
              v.id,
              diff,
              'manual_adjustment',
              'Updated via product editor',
              req.user!.id
            );
          }
        } else {
          const vId = crypto.randomUUID();
          db.prepare('INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, price_override) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            vId,
            prodId,
            finalSku,
            v.size,
            v.color,
            v.color_hex,
            v.price_override ?? null
          );
          db.prepare('INSERT INTO inventory (variant_id, quantity_available, low_stock_threshold) VALUES (?, ?, ?)').run(
            vId,
            v.quantity_available,
            v.low_stock_threshold
          );
          db.prepare('INSERT INTO inventory_movements (id, variant_id, change_amount, reason, note, performed_by) VALUES (?, ?, ?, ?, ?, ?)').run(
            crypto.randomUUID(),
            vId,
            v.quantity_available,
            'initial_stock',
            'Added variant via product editor',
            req.user!.id
          );
        }
      }
    })();
    logAdminAction(req.user, 'update_product', 'product', prodId, { title: d.title });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update product.' });
  }
});

router.post('/products/:id/duplicate', requireStaff('manage_products'), (req, res) => {
  const src = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
  if (!src) return res.status(404).json({ error: 'Product not found' });
  const newId = crypto.randomUUID();
  const suffix = Date.now().toString().slice(-4);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO products (id, title, title_hi, slug, sku_prefix, description, fabric_care, department, category_id, subcategory_id, regular_price, discounted_price, product_type, tags_json, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(
      newId,
      `${src.title} (Copy)`,
      src.title_hi,
      `${src.slug}-copy-${suffix}`,
      `${src.sku_prefix}-${suffix}`,
      src.description,
      src.fabric_care,
      src.department,
      src.category_id,
      src.subcategory_id,
      src.regular_price,
      src.discounted_price,
      src.product_type,
      src.tags_json
    );
    const imgs = db.prepare('SELECT * FROM product_images WHERE product_id = ?').all(src.id) as any[];
    for (const img of imgs) {
      db.prepare('INSERT INTO product_images (id, product_id, image_url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, ?, ?)').run(
        crypto.randomUUID(),
        newId,
        img.image_url,
        img.alt_text,
        img.sort_order,
        img.is_primary
      );
    }
    const vars = db.prepare('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1').all(src.id) as any[];
    for (const v of vars) {
      const nvId = crypto.randomUUID();
      db.prepare('INSERT INTO product_variants (id, product_id, sku, size, color, color_hex) VALUES (?, ?, ?, ?, ?, ?)').run(
        nvId,
        newId,
        `${v.sku}-${suffix}`,
        v.size,
        v.color,
        v.color_hex
      );
      db.prepare('INSERT INTO inventory (variant_id, quantity_available, low_stock_threshold) VALUES (?, 0, 5)').run(nvId);
    }
  })();
  logAdminAction(req.user, 'duplicate_product', 'product', newId, { source: src.id });
  return res.status(201).json({ id: newId });
});

router.patch('/products/bulk', requireStaff('manage_products'), (req, res) => {
  const { ids, action } = req.body as { ids: string[]; action: 'publish' | 'unpublish' | 'archive' | 'unarchive' | 'delete' };
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'Select products first.' });
  const ph = ids.map(() => '?').join(',');
  if (action === 'publish') db.prepare(`UPDATE products SET is_published = 1, review_status = 'approved', updated_at = datetime('now') WHERE id IN (${ph})`).run(...ids);
  else if (action === 'unpublish') db.prepare(`UPDATE products SET is_published = 0, updated_at = datetime('now') WHERE id IN (${ph})`).run(...ids);
  else if (action === 'archive') db.prepare(`UPDATE products SET is_archived = 1, is_published = 0, updated_at = datetime('now') WHERE id IN (${ph})`).run(...ids);
  else if (action === 'unarchive') db.prepare(`UPDATE products SET is_archived = 0, updated_at = datetime('now') WHERE id IN (${ph})`).run(...ids);
  else if (action === 'delete') db.prepare(`DELETE FROM products WHERE id IN (${ph})`).run(...ids);

  logAdminAction(req.user, `bulk_${action}`, 'product', undefined, { count: ids.length });
  return res.json({ ok: true });
});

router.patch('/products/:id/publish', requireStaff('manage_products'), (req, res) => {
  const publish = req.body?.is_published !== false;
  db.prepare(`UPDATE products SET is_published = ?, review_status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    publish ? 1 : 0,
    publish ? 'approved' : 'draft_needs_review',
    req.params.id
  );
  logAdminAction(req.user, publish ? 'publish_product' : 'unpublish_product', 'product', req.params.id);
  return res.json({ ok: true });
});

router.get('/products/export/csv', requireStaff('manage_products'), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.title, p.slug, p.sku_prefix, p.department, p.regular_price, p.discounted_price, p.product_type, p.is_published,
              pv.sku, pv.size, pv.color, COALESCE(i.quantity_available, 0) as stock
       FROM products p LEFT JOIN product_variants pv ON pv.product_id = p.id LEFT JOIN inventory i ON i.variant_id = pv.id`
    )
    .all() as any[];
  const csv = [
    'title,slug,sku_prefix,department,regular_price,discounted_price,product_type,is_published,variant_sku,size,color,stock',
    ...rows.map((r) =>
      [
        `"${String(r.title).replace(/"/g, '""')}"`,
        r.slug,
        r.sku_prefix,
        r.department,
        r.regular_price,
        r.discounted_price ?? '',
        r.product_type,
        r.is_published,
        r.sku ?? '',
        r.size ?? '',
        r.color ?? '',
        r.stock ?? 0,
      ].join(',')
    ),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="arora-garments-catalog.csv"');
  return res.send(csv);
});

router.post('/products/import/csv', requireStaff('manage_products'), (req, res) => {
  const { csv } = req.body as { csv?: string };
  if (!csv) return res.status(400).json({ error: 'CSV content is required.' });
  const lines = csv.trim().split(/\r?\n/).slice(1);
  let imported = 0;
  db.transaction(() => {
    for (const line of lines) {
      const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 6) continue;
      const [title, slug, skuPrefix, department, regPrice, discPrice] = cols;
      if (!title || !slug || !skuPrefix) continue;
      const pid = crypto.randomUUID();
      db.prepare(
        `INSERT OR IGNORE INTO products (id, title, slug, sku_prefix, description, department, regular_price, discounted_price, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`
      ).run(pid, title, slug, skuPrefix, title, department || 'mens-wear', Number(regPrice) || 999, discPrice ? Number(discPrice) : null);
      const vid = crypto.randomUUID();
      db.prepare('INSERT OR IGNORE INTO product_variants (id, product_id, sku, size, color) VALUES (?, ?, ?, ?, ?)').run(
        vid,
        pid,
        `${skuPrefix}-M-BLK`,
        'M',
        'Default'
      );
      db.prepare('INSERT OR IGNORE INTO inventory (variant_id, quantity_available) VALUES (?, 10)').run(vid);
      imported++;
    }
  })();
  logAdminAction(req.user, 'import_csv', 'product', undefined, { imported });
  return res.json({ imported });
});

// 4. Inventory Management
router.get('/inventory', requireStaff(), (_req, res) => {
  const variants = db
    .prepare(
      `SELECT pv.id as variant_id, pv.sku, pv.size, pv.color, p.id as product_id, p.title, p.department,
              i.quantity_available, i.quantity_reserved, i.low_stock_threshold, i.updated_at
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       JOIN inventory i ON i.variant_id = pv.id
       WHERE pv.is_active = 1 AND p.is_archived = 0
       ORDER BY i.quantity_available ASC, p.title ASC`
    )
    .all();
  const movements = db
    .prepare(
      `SELECT im.*, pv.sku, p.title as product_title, pr.full_name as performer_name
       FROM inventory_movements im
       JOIN product_variants pv ON pv.id = im.variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN profiles pr ON pr.id = im.performed_by
       ORDER BY im.created_at DESC LIMIT 80`
    )
    .all();
  return res.json({ variants, movements });
});

router.post('/inventory/adjust', requireStaff('manage_inventory'), (req, res) => {
  const schema = z.object({
    variant_id: z.string().min(1),
    new_quantity: z.number().int().min(0),
    low_stock_threshold: z.number().int().min(0).optional(),
    reason: z.enum(['manual_adjustment', 'reconciliation']).default('manual_adjustment'),
    note: z.string().trim().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid stock adjustment.' });

  const { variant_id, new_quantity, low_stock_threshold, reason, note } = parsed.data;
  db.transaction(() => {
    const cur = db.prepare('SELECT quantity_available, low_stock_threshold FROM inventory WHERE variant_id = ?').get(variant_id) as any;
    if (!cur) throw new Error('Variant inventory record not found.');
    const diff = new_quantity - cur.quantity_available;
    db.prepare(`UPDATE inventory SET quantity_available = ?, low_stock_threshold = COALESCE(?, low_stock_threshold), updated_at = datetime('now') WHERE variant_id = ?`).run(
      new_quantity,
      low_stock_threshold ?? null,
      variant_id
    );
    db.prepare('INSERT INTO inventory_movements (id, variant_id, change_amount, reason, note, performed_by) VALUES (?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      variant_id,
      diff,
      reason,
      note || `Adjusted to ${new_quantity}`,
      req.user!.id
    );
  })();
  logAdminAction(req.user, 'adjust_inventory', 'inventory', variant_id, { new_quantity, reason });
  return res.json({ ok: true });
});

// 5. Categories & Collections & Coupons
router.get('/categories', requireStaff(), (_req, res) => {
  return res.json({ categories: db.prepare('SELECT * FROM categories ORDER BY department, sort_order ASC').all() });
});

router.post('/categories', requireStaff('manage_categories'), (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2),
    name_hi: z.string().optional(),
    slug: z.string().trim().min(2),
    department: z.enum(['mens-wear', 'womens-wear', 'kids-wear', 'footwear']),
    parent_id: z.string().nullable().optional(),
    image_url: z.string().optional(),
    sort_order: z.number().int().default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid category payload.' });
  const id = crypto.randomUUID();
  const d = parsed.data;
  db.prepare(
    'INSERT INTO categories (id, name, name_hi, slug, department, parent_id, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, d.name, d.name_hi || null, d.slug, d.department, d.parent_id || null, d.image_url || null, d.sort_order);
  logAdminAction(req.user, 'create_category', 'category', id, { name: d.name });
  return res.status(201).json({ id });
});

router.put('/categories/:id', requireStaff('manage_categories'), (req, res) => {
  const { name, name_hi, slug, department, parent_id, sort_order, is_active, image_url } = req.body;
  db.prepare(
    `UPDATE categories SET name = ?, name_hi = ?, slug = ?, department = ?, parent_id = ?, sort_order = ?, is_active = ?, image_url = COALESCE(?, image_url), updated_at = datetime('now') WHERE id = ?`
  ).run(name, name_hi || null, slug, department, parent_id || null, sort_order ?? 0, is_active ? 1 : 0, image_url || null, req.params.id);
  logAdminAction(req.user, 'update_category', 'category', req.params.id, { name });
  return res.json({ ok: true });
});

router.delete('/categories/:id', requireStaff('manage_categories'), (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  logAdminAction(req.user, 'delete_category', 'category', req.params.id);
  return res.json({ ok: true });
});

router.get('/collections', requireStaff(), (_req, res) => {
  const cols = db.prepare('SELECT * FROM collections ORDER BY sort_order ASC').all() as any[];
  const hydrated = cols.map((c) => {
    const productIds = db
      .prepare('SELECT product_id FROM collection_products WHERE collection_id = ?')
      .all(c.id)
      .map((r: any) => r.product_id);
    return { ...c, product_ids: productIds };
  });
  return res.json({ collections: hydrated });
});

router.post('/collections', requireStaff('manage_cms'), (req, res) => {
  const { name, slug, description, banner_image_url, sort_order } = req.body;
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO collections (id, name, slug, description, banner_image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, name, slug, description || '', banner_image_url || null, sort_order ?? 0
  );
  logAdminAction(req.user, 'create_collection', 'collection', id, { name });
  return res.status(201).json({ id });
});

router.put('/collections/:id', requireStaff('manage_cms'), (req, res) => {
  const { name, slug, description, banner_image_url, sort_order, is_active } = req.body;
  db.prepare(
    `UPDATE collections SET
      name = COALESCE(?, name),
      slug = COALESCE(?, slug),
      description = COALESCE(?, description),
      banner_image_url = COALESCE(?, banner_image_url),
      sort_order = COALESCE(?, sort_order),
      is_active = COALESCE(?, is_active)
     WHERE id = ?`
  ).run(
    name ?? null,
    slug ?? null,
    description ?? null,
    banner_image_url ?? null,
    sort_order ?? null,
    typeof is_active === 'boolean' ? (is_active ? 1 : 0) : null,
    req.params.id
  );
  logAdminAction(req.user, 'update_collection', 'collection', req.params.id, { name });
  return res.json({ ok: true });
});

router.put('/collections/:id/products', requireStaff('manage_cms'), (req, res) => {
  const { product_ids } = req.body as { product_ids: string[] };
  db.transaction(() => {
    db.prepare('DELETE FROM collection_products WHERE collection_id = ?').run(req.params.id);
    (product_ids || []).forEach((pid, idx) => {
      db.prepare('INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, ?)').run(
        req.params.id,
        pid,
        idx
      );
    });
  })();
  logAdminAction(req.user, 'update_collection_products', 'collection', req.params.id, { count: product_ids?.length || 0 });
  return res.json({ ok: true });
});

router.delete('/collections/:id', requireStaff('manage_cms'), (req, res) => {
  db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
  return res.json({ ok: true });
});

router.get('/coupons', requireStaff(), (_req, res) => {
  return res.json({ coupons: db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() });
});

router.post('/coupons', requireStaff('manage_coupons'), (req, res) => {
  const { code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit } = req.body;
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    String(code).toUpperCase(),
    description || '',
    discount_type || 'percentage',
    Number(discount_value),
    Number(min_order_amount || 0),
    max_discount_amount ? Number(max_discount_amount) : null,
    usage_limit ? Number(usage_limit) : null
  );
  logAdminAction(req.user, 'create_coupon', 'coupon', id, { code });
  return res.status(201).json({ id });
});

router.delete('/coupons/:id', requireStaff('manage_coupons'), (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  return res.json({ ok: true });
});

// 6. Order Management & Return/Refunds
router.get('/orders', requireStaff('manage_orders'), (req, res) => {
  const { status, source, q } = req.query as Record<string, string>;
  const where: string[] = ['1=1'];
  const params: any[] = [];
  if (status && status !== 'all') {
    where.push('order_status = ?');
    params.push(status);
  }
  if (source && source !== 'all') {
    where.push('order_source = ?');
    params.push(source);
  }
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    where.push('(order_number LIKE ? OR customer_name LIKE ? OR customer_mobile LIKE ?)');
    params.push(like, like, like);
  }
  const orders = db
    .prepare(`SELECT * FROM orders WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200`)
    .all(...params) as any[];

  const hydrated = orders.map((o) => ({
    ...o,
    shipping_address: JSON.parse(o.shipping_address_json),
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
    history: db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at DESC').all(o.id),
  }));
  return res.json({ orders: hydrated });
});

// Create manual order (Admin or confirmed WhatsApp order) with atomic stock deduction
router.post('/orders', requireStaff('manage_orders'), (req, res) => {
  const schema = z.object({
    customer_name: z.string().min(2),
    customer_mobile: z.string().min(10),
    address_line: z.string().min(4),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().min(6).max(6),
    order_source: z.enum(['WhatsApp', 'Admin']).default('Admin'),
    payment_method: z.enum(['COD', 'UPI_WHATSAPP', 'WHATSAPP_MANUAL']).default('COD'),
    shipping_fee: z.number().min(0).default(0),
    items: z.array(z.object({ variant_id: z.string().min(1), quantity: z.number().int().min(1) })).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid manual order payload.' });

  const d = parsed.data;
  const orderId = crypto.randomUUID();
  const shortNum = (d.order_source === 'WhatsApp' ? 'WA-' : 'ADM-') + Date.now().toString().slice(-6);
  const invNum = `INV-${shortNum}`;

  try {
    db.transaction(() => {
      let subtotal = 0;
      const lineItems: any[] = [];
      for (const it of d.items) {
        const v = db
          .prepare(
            `SELECT pv.*, p.title, p.regular_price, p.discounted_price, p.gst_rate, i.quantity_available
             FROM product_variants pv JOIN products p ON p.id = pv.product_id JOIN inventory i ON i.variant_id = pv.id
             WHERE pv.id = ?`
          )
          .get(it.variant_id) as any;
        if (!v || v.quantity_available < it.quantity) {
          throw new Error(`Insufficient stock for SKU ${v?.sku || it.variant_id}`);
        }
        db.prepare(`UPDATE inventory SET quantity_available = quantity_available - ?, updated_at = datetime('now') WHERE variant_id = ?`).run(
          it.quantity,
          it.variant_id
        );
        db.prepare('INSERT INTO inventory_movements (id, variant_id, change_amount, reason, reference_id, note, performed_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
          crypto.randomUUID(),
          it.variant_id,
          -it.quantity,
          'order_placed',
          shortNum,
          `${d.order_source} order created by ${req.user!.full_name}`,
          req.user!.id
        );
        const unitPrice = v.price_override ?? (v.discounted_price != null && v.discounted_price < v.regular_price ? v.discounted_price : v.regular_price);
        const lineTotal = unitPrice * it.quantity;
        subtotal += lineTotal;
        lineItems.push({ ...v, quantity: it.quantity, unitPrice, lineTotal });
      }

      const invSettingRow = db.prepare(`SELECT value_json FROM website_settings WHERE key = 'invoice_settings'`).get() as { value_json: string } | undefined;
      let invoiceSettings: GstInvoiceSettings = {};
      if (invSettingRow) {
        try {
          invoiceSettings = JSON.parse(invSettingRow.value_json);
        } catch {}
      }
      const gstCalc = calculateOrderGst({
        items: lineItems.map((li) => ({
          title: li.title,
          quantity: li.quantity,
          line_total: li.lineTotal,
          gst_rate: li.gst_rate ?? null,
        })),
        discountAmount: 0,
        shippingFee: d.shipping_fee,
        customerState: d.state,
        invoiceSettings,
      });

      const addr = { address_line: d.address_line, locality: '', city: d.city, state: d.state, pincode: d.pincode };
      db.prepare(
        `INSERT INTO orders (
          id, order_number, invoice_number, customer_name, customer_mobile,
          shipping_address_json, billing_address_json, subtotal, shipping_fee,
          taxable_amount, cgst_amount, sgst_amount, igst_amount, tax_amount, gst_breakdown_json,
          grand_total, payment_method, payment_status, order_source, order_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'Confirmed')`
      ).run(
        orderId,
        shortNum,
        invNum,
        d.customer_name,
        d.customer_mobile,
        JSON.stringify(addr),
        JSON.stringify(addr),
        subtotal,
        d.shipping_fee,
        gstCalc.taxable_amount,
        gstCalc.cgst_amount,
        gstCalc.sgst_amount,
        gstCalc.igst_amount,
        gstCalc.tax_amount,
        JSON.stringify(gstCalc),
        gstCalc.grand_total,
        d.payment_method,
        d.order_source
      );

      for (const li of lineItems) {
        db.prepare(
          'INSERT INTO order_items (id, order_id, product_id, variant_id, product_title, sku, size, color, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(crypto.randomUUID(), orderId, li.product_id, li.id, li.title, li.sku, li.size, li.color, li.quantity, li.unitPrice, li.lineTotal);
      }

      db.prepare('INSERT INTO order_status_history (id, order_id, status, note, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?)').run(
        crypto.randomUUID(),
        orderId,
        'Confirmed',
        `Created manually via ${d.order_source}`,
        req.user!.id,
        req.user!.full_name
      );
    })();
    logAdminAction(req.user, 'create_manual_order', 'order', orderId, { order_number: shortNum });
    return res.status(201).json({ id: orderId, order_number: shortNum });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.patch('/orders/:id', requireStaff('manage_orders'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const { order_status, payment_status, courier_partner, tracking_number, tracking_url, expected_delivery_date, note } = req.body;

  db.transaction(() => {
    const newStatus = order_status || order.order_status;
    const newPayStatus = payment_status || order.payment_status;

    // Restore stock once when transitioning to Cancelled
    if (order_status === 'Cancelled' && order.order_status !== 'Cancelled') {
      const items = db.prepare('SELECT variant_id, quantity FROM order_items WHERE order_id = ?').all(order.id) as Array<{
        variant_id: string | null;
        quantity: number;
      }>;
      for (const it of items) {
        if (it.variant_id) {
          db.prepare(`UPDATE inventory SET quantity_available = quantity_available + ?, updated_at = datetime('now') WHERE variant_id = ?`).run(
            it.quantity,
            it.variant_id
          );
          db.prepare('INSERT INTO inventory_movements (id, variant_id, change_amount, reason, reference_id, note, performed_by) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            crypto.randomUUID(),
            it.variant_id,
            it.quantity,
            'order_cancelled',
            order.order_number,
            `Restored on cancellation of ${order.order_number}`,
            req.user!.id
          );
        }
      }
    }

    const shippedAt = newStatus === 'Shipped' && !order.shipped_at ? new Date().toISOString() : order.shipped_at;

    db.prepare(
      `UPDATE orders SET
        order_status = ?, payment_status = ?, courier_partner = COALESCE(?, courier_partner),
        tracking_number = COALESCE(?, tracking_number), tracking_url = COALESCE(?, tracking_url),
        expected_delivery_date = COALESCE(?, expected_delivery_date), shipped_at = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      newStatus,
      newPayStatus,
      courier_partner ?? null,
      tracking_number ?? null,
      tracking_url ?? null,
      expected_delivery_date ?? null,
      shippedAt,
      order.id
    );

    if (order_status && order_status !== order.order_status) {
      db.prepare('INSERT INTO order_status_history (id, order_id, status, note, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?)').run(
        crypto.randomUUID(),
        order.id,
        newStatus,
        note || `Updated to ${newStatus}`,
        req.user!.id,
        req.user!.full_name
      );
      sendWhatsAppNotification(
        order.customer_mobile,
        `Arora Garments Update: Your order ${order.order_number} is now ${newStatus}.${tracking_number ? ` Tracking: ${tracking_number}` : ''}`
      ).catch(() => {});
    }
  })();

  logAdminAction(req.user, 'update_order', 'order', order.id, { order_status, payment_status });
  return res.json({ ok: true });
});

// Manual UPI / Cash Payment Verification Queue
router.get('/payments', requireStaff('manage_orders'), (req, res) => {
  const { status, method } = req.query as Record<string, string>;
  const where: string[] = ['1=1'];
  const params: any[] = [];
  if (status && status !== 'all') {
    where.push('o.payment_status = ?');
    params.push(status);
  }
  if (method && method !== 'all') {
    where.push('o.payment_method = ?');
    params.push(method);
  }
  const rows = db
    .prepare(
      `SELECT o.id, o.order_number, o.invoice_number, o.customer_name, o.customer_mobile, o.grand_total,
              o.payment_method, o.payment_status, o.payment_reference, o.payment_claim_note,
              o.payment_verified_by, o.payment_verified_at, o.is_proforma, o.order_status, o.created_at
       FROM orders o
       WHERE ${where.join(' AND ')}
       ORDER BY CASE o.payment_status
         WHEN 'payment_claimed' THEN 1
         WHEN 'under_verification' THEN 2
         WHEN 'awaiting_payment' THEN 3
         WHEN 'pending' THEN 4
         ELSE 5 END, o.created_at DESC
       LIMIT 200`
    )
    .all(...params);
  return res.json({ payments: rows });
});

router.patch('/payments/:orderId/verify', requireStaff('manage_orders'), (req, res) => {
  const schema = z.object({
    payment_status: z.enum(['awaiting_payment', 'payment_claimed', 'under_verification', 'paid', 'rejected', 'refunded', 'collected', 'pending']),
    payment_reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(300).optional(),
    auto_confirm_order: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payment verification payload.' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId) as any;
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const d = parsed.data;
  const isFinalPaid = d.payment_status === 'paid' || d.payment_status === 'collected';
  const verifiedAt = isFinalPaid ? new Date().toISOString() : order.payment_verified_at;
  const verifiedBy = isFinalPaid ? req.user!.full_name : order.payment_verified_by;
  const nextOrderStatus =
    d.auto_confirm_order && isFinalPaid && order.order_status === 'Pending Confirmation'
      ? 'Confirmed'
      : order.order_status;
  const payTableStatus = d.payment_status === 'paid' ? 'verified' : d.payment_status;

  db.transaction(() => {
    db.prepare(
      `UPDATE orders SET
        payment_status = ?,
        payment_reference = COALESCE(?, payment_reference),
        payment_verified_by = ?,
        payment_verified_at = ?,
        is_proforma = ?,
        order_status = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      d.payment_status,
      d.payment_reference ?? null,
      verifiedBy ?? null,
      verifiedAt ?? null,
      isFinalPaid ? 0 : 1,
      nextOrderStatus,
      order.id
    );

    db.prepare(`UPDATE payments SET status = ?, updated_at = datetime('now') WHERE order_id = ?`).run(payTableStatus, order.id);

    db.prepare('INSERT INTO order_status_history (id, order_id, status, note, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      order.id,
      nextOrderStatus,
      d.note || `Payment marked '${d.payment_status}' by ${req.user!.full_name}${d.payment_reference ? ` (Ref: ${d.payment_reference})` : ''}`,
      req.user!.id,
      req.user!.full_name
    );
  })();

  logAdminAction(req.user, 'verify_payment', 'order', order.id, {
    order_number: order.order_number,
    payment_status: d.payment_status,
    payment_reference: d.payment_reference,
  });
  return res.json({ ok: true, is_proforma: isFinalPaid ? 0 : 1 });
});

router.get('/returns', requireStaff('manage_orders'), (_req, res) => {
  const returns = db
    .prepare(
      `SELECT rr.*, o.order_number, o.customer_name, o.customer_mobile, o.grand_total
       FROM return_requests rr JOIN orders o ON o.id = rr.order_id ORDER BY rr.created_at DESC`
    )
    .all();
  return res.json({ returns });
});

router.patch('/returns/:id', requireStaff('manage_orders'), (req, res) => {
  const { status, admin_notes, refund_status, refund_amount, refund_method, reference_number } = req.body;
  const rr = db.prepare('SELECT * FROM return_requests WHERE id = ?').get(req.params.id) as any;
  if (!rr) return res.status(404).json({ error: 'Return request not found' });

  db.transaction(() => {
    db.prepare(`UPDATE return_requests SET status = ?, admin_notes = ?, reviewed_by = ?, updated_at = datetime('now') WHERE id = ?`).run(
      status,
      admin_notes || null,
      req.user!.id,
      rr.id
    );
    if (status === 'Approved') {
      db.prepare(`UPDATE orders SET order_status = 'Returned', updated_at = datetime('now') WHERE id = ?`).run(rr.order_id);
      if (refund_amount != null) {
        db.prepare(
          'INSERT INTO refund_records (id, return_request_id, order_id, amount, refund_method, status, reference_number, processed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          crypto.randomUUID(),
          rr.id,
          rr.order_id,
          Number(refund_amount),
          refund_method || 'UPI / Bank',
          refund_status || 'Pending',
          reference_number || null,
          req.user!.id
        );
      }
    }
  })();
  logAdminAction(req.user, 'review_return', 'return_request', rr.id, { status });
  return res.json({ ok: true });
});

// 7. Customers List
router.get('/customers', requireStaff('view_customers'), (_req, res) => {
  const customers = db
    .prepare(
      `SELECT p.id, p.full_name, p.phone, p.email, p.created_at,
              COUNT(o.id) as order_count, COALESCE(SUM(o.grand_total), 0) as total_spent
       FROM profiles p
       JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'customer'
       LEFT JOIN orders o ON o.user_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    )
    .all();
  return res.json({ customers });
});

// 8. Homepage CMS, Banners, Settings, Pincodes, Shipping
router.get('/cms', requireStaff(), (_req, res) => {
  const sections = db.prepare('SELECT * FROM homepage_sections ORDER BY sort_order ASC').all();
  const banners = db.prepare('SELECT * FROM banners ORDER BY sort_order ASC').all();
  const settingsRows = db.prepare('SELECT * FROM website_settings').all() as Array<{ key: string; value_json: string }>;
  const settings: Record<string, any> = {};
  for (const r of settingsRows) settings[r.key] = JSON.parse(r.value_json);
  const pincodes = db.prepare('SELECT * FROM serviceable_pincodes ORDER BY pincode ASC').all();
  const shipping_methods = db.prepare('SELECT * FROM shipping_methods ORDER BY sort_order ASC').all();
  return res.json({ sections, banners, settings, pincodes, shipping_methods });
});

router.post('/homepage-sections', requireStaff('manage_cms'), (req, res) => {
  const { section_key, section_type, title, subtitle, cta_label, cta_link, image_url, sort_order, is_visible } = req.body;
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO homepage_sections (id, section_key, section_type, title, subtitle, cta_label, cta_link, image_url, sort_order, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, section_key, section_type || 'campaign', title, subtitle || '', cta_label || '', cta_link || '', image_url || '', sort_order ?? 10, is_visible ? 1 : 0);
  logAdminAction(req.user, 'create_section', 'homepage_section', id, { title });
  return res.status(201).json({ id });
});

router.put('/homepage-sections/:id', requireStaff('manage_cms'), (req, res) => {
  const { title, subtitle, cta_label, cta_link, image_url, sort_order, is_visible } = req.body;
  db.prepare(
    `UPDATE homepage_sections SET title = ?, subtitle = ?, cta_label = ?, cta_link = ?, image_url = ?, sort_order = ?, is_visible = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, subtitle || '', cta_label || '', cta_link || '', image_url || '', sort_order ?? 0, is_visible ? 1 : 0, req.params.id);
  logAdminAction(req.user, 'update_section', 'homepage_section', req.params.id, { title, is_visible });
  return res.json({ ok: true });
});

router.delete('/homepage-sections/:id', requireStaff('manage_cms'), (req, res) => {
  db.prepare('DELETE FROM homepage_sections WHERE id = ?').run(req.params.id);
  return res.json({ ok: true });
});

router.post('/banners', requireStaff('manage_cms'), (req, res) => {
  const { title, subtitle, cta_label, image_url, link_url, placement, sort_order, duration_seconds, is_active } = req.body;
  if (!title || !image_url) return res.status(400).json({ error: 'Slide title and image are required.' });
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO banners (id, title, subtitle, cta_label, image_url, link_url, placement, sort_order, duration_seconds, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    title,
    subtitle || '',
    cta_label || 'Explore Collection',
    image_url,
    link_url || '/products',
    placement || 'hero',
    sort_order ?? 0,
    Math.max(3, Math.min(30, Number(duration_seconds || 8))),
    is_active === false ? 0 : 1
  );
  logAdminAction(req.user, 'create_banner', 'banner', id, { title });
  return res.status(201).json({ id });
});

router.patch('/banners/reorder', requireStaff('manage_cms'), (req, res) => {
  const { ordered_ids } = req.body as { ordered_ids?: string[] };
  if (!Array.isArray(ordered_ids)) return res.status(400).json({ error: 'ordered_ids array required' });
  db.transaction(() => {
    ordered_ids.forEach((id, idx) => {
      db.prepare('UPDATE banners SET sort_order = ? WHERE id = ?').run(idx + 1, id);
    });
  })();
  logAdminAction(req.user, 'reorder_banners', 'banner', undefined, { count: ordered_ids.length });
  return res.json({ ok: true });
});

router.put('/banners/:id', requireStaff('manage_cms'), (req, res) => {
  const { title, subtitle, cta_label, image_url, link_url, placement, sort_order, duration_seconds, is_active } = req.body;
  db.prepare(
    `UPDATE banners SET
      title = COALESCE(?, title),
      subtitle = COALESCE(?, subtitle),
      cta_label = COALESCE(?, cta_label),
      image_url = COALESCE(?, image_url),
      link_url = COALESCE(?, link_url),
      placement = COALESCE(?, placement),
      sort_order = COALESCE(?, sort_order),
      duration_seconds = COALESCE(?, duration_seconds),
      is_active = COALESCE(?, is_active)
     WHERE id = ?`
  ).run(
    title ?? null,
    subtitle ?? null,
    cta_label ?? null,
    image_url ?? null,
    link_url ?? null,
    placement ?? null,
    sort_order !== undefined ? Number(sort_order) : null,
    duration_seconds !== undefined ? Math.max(3, Math.min(30, Number(duration_seconds))) : null,
    typeof is_active === 'boolean' ? (is_active ? 1 : 0) : is_active !== undefined ? (is_active ? 1 : 0) : null,
    req.params.id
  );
  logAdminAction(req.user, 'update_banner', 'banner', req.params.id, { title });
  return res.json({ ok: true });
});

router.delete('/banners/:id', requireStaff('manage_cms'), (req, res) => {
  db.prepare('DELETE FROM banners WHERE id = ?').run(req.params.id);
  logAdminAction(req.user, 'delete_banner', 'banner', req.params.id);
  return res.json({ ok: true });
});

router.put('/settings/:key', requireStaff('manage_settings'), (req, res) => {
  db.prepare(`INSERT INTO website_settings (key, value_json, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')`).run(
    req.params.key,
    JSON.stringify(req.body)
  );
  logAdminAction(req.user, 'update_settings', 'website_settings', req.params.key);
  return res.json({ ok: true });
});

router.post('/appearance/restore-default', requireStaff('manage_settings'), (req, res) => {
  const defaultAppearance = {
    active_theme_id: 'modern-classic',
    custom_overrides: {
      primary_color: '',
      secondary_color: '',
      background_color: '',
      surface_color: '',
      text_color: '',
      accent_color: '',
      heading_font: '',
      body_font: '',
      button_style: '',
      card_style: '',
      border_radius: '',
      animation_intensity: 'subtle',
    },
  };
  db.prepare(`INSERT INTO website_settings (key, value_json, updated_at) VALUES ('appearance', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now')`).run(
    JSON.stringify(defaultAppearance)
  );
  logAdminAction(req.user, 'restore_default_theme', 'website_settings', 'appearance');
  return res.json({ ok: true, appearance: defaultAppearance });
});

router.get('/pincodes', requireStaff(), (_req, res) => {
  const pincodes = db.prepare('SELECT * FROM serviceable_pincodes ORDER BY COALESCE(radius_km, 25) ASC, pincode ASC').all();
  return res.json({ pincodes });
});

router.post('/pincodes', requireStaff('manage_settings'), (req, res) => {
  const {
    pincode,
    area_name,
    town_name,
    city,
    state,
    radius_km,
    min_order_value,
    delivery_fee,
    free_delivery_above,
    cod_allowed,
    estimated_days,
    notes,
    is_active,
  } = req.body;
  db.prepare(
    `INSERT INTO serviceable_pincodes (pincode, area_name, town_name, city, state, radius_km, min_order_value, delivery_fee, free_delivery_above, cod_allowed, estimated_days, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(pincode) DO UPDATE SET
       area_name = excluded.area_name,
       town_name = excluded.town_name,
       city = excluded.city,
       state = excluded.state,
       radius_km = excluded.radius_km,
       min_order_value = excluded.min_order_value,
       delivery_fee = excluded.delivery_fee,
       free_delivery_above = excluded.free_delivery_above,
       cod_allowed = excluded.cod_allowed,
       estimated_days = excluded.estimated_days,
       notes = excluded.notes,
       is_active = excluded.is_active`
  ).run(
    String(pincode).trim(),
    area_name || town_name || 'Bulandshahr Region',
    town_name || area_name || 'Bulandshahr',
    city || 'Bulandshahr',
    state || 'Uttar Pradesh',
    radius_km != null ? Number(radius_km) : 25,
    min_order_value != null ? Number(min_order_value) : 0,
    Number(delivery_fee || 0),
    free_delivery_above !== undefined && free_delivery_above !== null && free_delivery_above !== '' ? Number(free_delivery_above) : null,
    cod_allowed !== false ? 1 : 0,
    estimated_days || '1-2 Days',
    notes || '',
    is_active !== false ? 1 : 0
  );
  logAdminAction(req.user, 'upsert_shipping_zone', 'serviceable_pincodes', String(pincode).trim());
  return res.json({ ok: true });
});

router.delete('/pincodes/:pincode', requireStaff('manage_settings'), (req, res) => {
  db.prepare('DELETE FROM serviceable_pincodes WHERE pincode = ?').run(req.params.pincode);
  return res.json({ ok: true });
});

// 9. Multi-Admin Staff & Permissions (Owner-Only) & Audit Logs
router.get('/staff', requireStaff('manage_admins'), (_req, res) => {
  const staff = db
    .prepare(
      `SELECT p.id, p.full_name, p.email, p.phone, p.is_active, p.created_at, ur.role
       FROM profiles p JOIN user_roles ur ON ur.user_id = p.id
       WHERE ur.role IN ('owner', 'manager', 'order_staff', 'content_staff')
       ORDER BY p.created_at ASC`
    )
    .all();
  const permissions = db.prepare('SELECT * FROM admin_permissions ORDER BY role, permission_key').all();
  return res.json({ staff, permissions });
});

router.post('/staff', requireStaff('manage_admins'), (req, res) => {
  const schema = z.object({
    full_name: z.string().trim().min(2),
    email: z.string().trim().email(),
    phone: z.string().trim().min(10),
    password: z.string().min(6),
    role: z.enum(['manager', 'order_staff', 'content_staff']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valid staff details required.' });
  const d = parsed.data;
  const userId = crypto.randomUUID();
  try {
    db.transaction(() => {
      db.prepare('INSERT INTO profiles (id, full_name, phone, email, password_hash) VALUES (?, ?, ?, ?, ?)').run(
        userId, d.full_name, d.phone, d.email.toLowerCase(), bcrypt.hashSync(d.password, 10)
      );
      db.prepare('INSERT INTO user_roles (id, user_id, role, assigned_by) VALUES (?, ?, ?, ?)').run(
        crypto.randomUUID(), userId, d.role, req.user!.id
      );
    })();
    logAdminAction(req.user, 'create_staff', 'user', userId, { role: d.role, email: d.email });
    return res.status(201).json({ id: userId });
  } catch (err: any) {
    return res.status(409).json({ error: 'Email or phone already exists.' });
  }
});

router.patch('/staff/:id', requireStaff('manage_admins'), (req, res) => {
  const { role, is_active } = req.body;
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: 'Owner cannot deactivate or demote themselves.' });
  }
  if (role) {
    db.prepare(`UPDATE user_roles SET role = ? WHERE user_id = ? AND role != 'customer'`).run(role, req.params.id);
  }
  if (typeof is_active === 'boolean') {
    db.prepare('UPDATE profiles SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
  }
  logAdminAction(req.user, 'update_staff', 'user', req.params.id, { role, is_active });
  return res.json({ ok: true });
});

router.put('/permissions', requireStaff('manage_permissions'), (req, res) => {
  const { role, permission_key, allowed } = req.body;
  if (role === 'owner') return res.status(400).json({ error: 'Owner permissions cannot be restricted.' });
  db.prepare(`UPDATE admin_permissions SET allowed = ?, updated_at = datetime('now') WHERE role = ? AND permission_key = ?`).run(
    allowed ? 1 : 0,
    role,
    permission_key
  );
  logAdminAction(req.user, 'update_permission', 'admin_permissions', `${role}:${permission_key}`, { allowed });
  return res.json({ ok: true });
});

router.get('/activity-logs', requireStaff(), (_req, res) => {
  const logs = db.prepare('SELECT * FROM admin_activity_logs ORDER BY created_at DESC LIMIT 120').all();
  return res.json({ logs });
});

// 11. Customer Reviews Moderation & Replies
router.get('/reviews', requireStaff(), (req, res) => {
  const { status = 'all', rating, q } = req.query as { status?: string; rating?: string; q?: string };
  let where = 'WHERE 1=1';
  const params: any[] = [];

  if (status === 'approved') where += ' AND r.is_approved = 1';
  else if (status === 'hidden') where += ' AND r.is_approved = 0';

  if (rating && ['1', '2', '3', '4', '5'].includes(rating)) {
    where += ' AND r.rating = ?';
    params.push(Number(rating));
  }

  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    where += ' AND (p.title LIKE ? OR r.reviewer_name LIKE ? OR r.comment LIKE ?)';
    params.push(like, like, like);
  }

  const reviews = db
    .prepare(
      `SELECT r.*, p.title as product_title, p.slug as product_slug, p.sku_prefix,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) as product_image,
              pr.email as customer_email, pr.phone as customer_phone
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       LEFT JOIN profiles pr ON pr.id = r.user_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT 200`
    )
    .all(...params);

  const statsRow = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved,
         SUM(CASE WHEN is_approved = 0 THEN 1 ELSE 0 END) as hidden,
         COALESCE(AVG(rating), 0) as average_rating,
         SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as r5,
         SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as r4,
         SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as r3,
         SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as r2,
         SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as r1
       FROM reviews`
    )
    .get() as any;

  return res.json({
    reviews,
    stats: {
      total: Number(statsRow?.total || 0),
      approved: Number(statsRow?.approved || 0),
      hidden: Number(statsRow?.hidden || 0),
      average_rating: Math.round(Number(statsRow?.average_rating || 0) * 10) / 10,
      distribution: [
        { star: '5 ★', rating: 5, count: Number(statsRow?.r5 || 0) },
        { star: '4 ★', rating: 4, count: Number(statsRow?.r4 || 0) },
        { star: '3 ★', rating: 3, count: Number(statsRow?.r3 || 0) },
        { star: '2 ★', rating: 2, count: Number(statsRow?.r2 || 0) },
        { star: '1 ★', rating: 1, count: Number(statsRow?.r1 || 0) },
      ],
    },
  });
});

router.patch('/reviews/:id', requireStaff(), (req, res) => {
  const schema = z.object({
    is_approved: z.boolean().optional(),
    admin_reply: z.string().trim().max(800).nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid review update payload.' });

  const existing = db.prepare('SELECT id, product_id FROM reviews WHERE id = ?').get(req.params.id) as any;
  if (!existing) return res.status(404).json({ error: 'Review not found.' });

  if (typeof parsed.data.is_approved === 'boolean') {
    db.prepare(`UPDATE reviews SET is_approved = ?, updated_at = datetime('now') WHERE id = ?`).run(
      parsed.data.is_approved ? 1 : 0,
      req.params.id
    );
  }
  if (parsed.data.admin_reply !== undefined) {
    db.prepare(`UPDATE reviews SET admin_reply = ?, updated_at = datetime('now') WHERE id = ?`).run(
      parsed.data.admin_reply ? parsed.data.admin_reply : null,
      req.params.id
    );
  }

  logAdminAction(req.user, 'moderate_review', 'review', req.params.id, parsed.data);
  const updated = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  return res.json({ ok: true, review: updated });
});

router.delete('/reviews/:id', requireStaff(), (req, res) => {
  const existing = db.prepare('SELECT id FROM reviews WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Review not found.' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  logAdminAction(req.user, 'delete_review', 'review', req.params.id);
  return res.json({ ok: true });
});

export default router;
