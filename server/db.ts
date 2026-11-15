import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'arora.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function columnExists(table: string, col: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === col);
}

function migrateLegacyConstraintsAndColumns() {
  // 1. Add missing columns non-destructively
  if (!columnExists('products', 'review_status')) {
    db.exec(`ALTER TABLE products ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved'`);
  }

  if (!columnExists('orders', 'payment_reference')) {
    db.exec(`ALTER TABLE orders ADD COLUMN payment_reference TEXT`);
  }
  if (!columnExists('orders', 'payment_claim_note')) {
    db.exec(`ALTER TABLE orders ADD COLUMN payment_claim_note TEXT`);
  }
  if (!columnExists('orders', 'payment_verified_by')) {
    db.exec(`ALTER TABLE orders ADD COLUMN payment_verified_by TEXT`);
  }
  if (!columnExists('orders', 'payment_verified_at')) {
    db.exec(`ALTER TABLE orders ADD COLUMN payment_verified_at TEXT`);
  }
  if (!columnExists('orders', 'is_proforma')) {
    db.exec(`ALTER TABLE orders ADD COLUMN is_proforma INTEGER NOT NULL DEFAULT 0`);
  }

  if (!columnExists('serviceable_pincodes', 'town_name')) {
    db.exec(`ALTER TABLE serviceable_pincodes ADD COLUMN town_name TEXT`);
  }
  if (!columnExists('serviceable_pincodes', 'radius_km')) {
    db.exec(`ALTER TABLE serviceable_pincodes ADD COLUMN radius_km REAL DEFAULT 25`);
  }
  if (!columnExists('serviceable_pincodes', 'min_order_value')) {
    db.exec(`ALTER TABLE serviceable_pincodes ADD COLUMN min_order_value REAL DEFAULT 0`);
  }
  if (!columnExists('serviceable_pincodes', 'notes')) {
    db.exec(`ALTER TABLE serviceable_pincodes ADD COLUMN notes TEXT`);
  }

  if (!columnExists('products', 'gst_rate')) {
    db.exec(`ALTER TABLE products ADD COLUMN gst_rate REAL`);
  }
  if (!columnExists('orders', 'taxable_amount')) {
    db.exec(`ALTER TABLE orders ADD COLUMN taxable_amount REAL NOT NULL DEFAULT 0`);
  }
  if (!columnExists('orders', 'cgst_amount')) {
    db.exec(`ALTER TABLE orders ADD COLUMN cgst_amount REAL NOT NULL DEFAULT 0`);
  }
  if (!columnExists('orders', 'sgst_amount')) {
    db.exec(`ALTER TABLE orders ADD COLUMN sgst_amount REAL NOT NULL DEFAULT 0`);
  }
  if (!columnExists('orders', 'igst_amount')) {
    db.exec(`ALTER TABLE orders ADD COLUMN igst_amount REAL NOT NULL DEFAULT 0`);
  }
  if (!columnExists('orders', 'gst_breakdown_json')) {
    db.exec(`ALTER TABLE orders ADD COLUMN gst_breakdown_json TEXT`);
  }
  if (!columnExists('banners', 'cta_label')) {
    db.exec(`ALTER TABLE banners ADD COLUMN cta_label TEXT DEFAULT 'Explore Collection'`);
  }
  if (!columnExists('banners', 'duration_seconds')) {
    db.exec(`ALTER TABLE banners ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 8`);
  }
  if (!columnExists('reviews', 'admin_reply')) {
    db.exec(`ALTER TABLE reviews ADD COLUMN admin_reply TEXT`);
  }
  if (!columnExists('reviews', 'updated_at')) {
    db.exec(`ALTER TABLE reviews ADD COLUMN updated_at TEXT`);
  }

  // 2. Rebuild orders / payments tables cleanly ONLY if legacy CHECK constraint blocks UPI_WHATSAPP / awaiting_payment
  const ordersMeta = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'`)
    .get() as { sql: string } | undefined;

  if (ordersMeta && !ordersMeta.sql.includes('UPI_WHATSAPP')) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE orders_new (
          id TEXT PRIMARY KEY,
          order_number TEXT NOT NULL UNIQUE,
          invoice_number TEXT NOT NULL UNIQUE,
          idempotency_key TEXT UNIQUE,
          user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
          customer_name TEXT NOT NULL,
          customer_mobile TEXT NOT NULL,
          customer_email TEXT,
          shipping_address_json TEXT NOT NULL,
          billing_address_json TEXT NOT NULL,
          delivery_instructions TEXT,
          subtotal REAL NOT NULL CHECK (subtotal >= 0),
          discount_amount REAL NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
          shipping_fee REAL NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
          tax_amount REAL NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
          grand_total REAL NOT NULL CHECK (grand_total >= 0),
          coupon_code TEXT,
          payment_method TEXT NOT NULL CHECK (payment_method IN ('COD', 'UPI_WHATSAPP', 'WHATSAPP_MANUAL', 'RAZORPAY')),
          payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (
            payment_status IN ('pending', 'awaiting_payment', 'payment_claimed', 'under_verification', 'paid', 'rejected', 'refunded', 'collected', 'failed')
          ),
          payment_reference TEXT,
          payment_claim_note TEXT,
          payment_verified_by TEXT,
          payment_verified_at TEXT,
          is_proforma INTEGER NOT NULL DEFAULT 0,
          order_source TEXT NOT NULL DEFAULT 'Website' CHECK (order_source IN ('Website', 'WhatsApp', 'Admin')),
          order_status TEXT NOT NULL DEFAULT 'Pending Confirmation' CHECK (
            order_status IN (
              'Pending Confirmation', 'Confirmed', 'Processing', 'Packed', 'Shipped',
              'Out for Delivery', 'Delivered', 'Cancellation Requested', 'Cancelled',
              'Return Requested', 'Returned', 'Refund Pending', 'Refunded'
            )
          ),
          courier_partner TEXT,
          tracking_number TEXT,
          tracking_url TEXT,
          shipped_at TEXT,
          expected_delivery_date TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO orders_new (
          id, order_number, invoice_number, idempotency_key, user_id,
          customer_name, customer_mobile, customer_email,
          shipping_address_json, billing_address_json, delivery_instructions,
          subtotal, discount_amount, shipping_fee, tax_amount, grand_total, coupon_code,
          payment_method, payment_status, payment_reference, payment_claim_note, payment_verified_by, payment_verified_at, is_proforma,
          order_source, order_status, courier_partner, tracking_number, tracking_url,
          shipped_at, expected_delivery_date, created_at, updated_at
        )
        SELECT
          id, order_number, invoice_number, idempotency_key, user_id,
          customer_name, customer_mobile, customer_email,
          shipping_address_json, billing_address_json, delivery_instructions,
          subtotal, discount_amount, shipping_fee, tax_amount, grand_total, coupon_code,
          payment_method, payment_status, payment_reference, payment_claim_note, payment_verified_by, payment_verified_at, is_proforma,
          order_source, order_status, courier_partner, tracking_number, tracking_url,
          shipped_at, expected_delivery_date, created_at, updated_at
        FROM orders;

        DROP TABLE orders;
        ALTER TABLE orders_new RENAME TO orders;
        CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status, created_at);
      `);
    })();
    db.pragma('foreign_keys = ON');
  }

  const payMeta = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='payments'`)
    .get() as { sql: string } | undefined;

  if (payMeta && !payMeta.sql.includes('UPI_WHATSAPP')) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`
        CREATE TABLE payments_new (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          provider TEXT NOT NULL CHECK (provider IN ('COD', 'UPI_WHATSAPP', 'MANUAL', 'RAZORPAY')),
          razorpay_order_id TEXT UNIQUE,
          razorpay_payment_id TEXT UNIQUE,
          razorpay_signature TEXT,
          amount REAL NOT NULL CHECK (amount >= 0),
          currency TEXT NOT NULL DEFAULT 'INR',
          status TEXT NOT NULL CHECK (
            status IN ('created', 'pending', 'awaiting_payment', 'payment_claimed', 'under_verification', 'verified', 'rejected', 'failed', 'refunded', 'collected')
          ),
          raw_payload_json TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO payments_new
        SELECT id, order_id, provider, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, currency, status, raw_payload_json, created_at, updated_at
        FROM payments;

        DROP TABLE payments;
        ALTER TABLE payments_new RENAME TO payments;
      `);
    })();
    db.pragma('foreign_keys = ON');
  }
}

export function initDatabase() {
  db.exec(`
    -- 1. profiles
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT,
      preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi')),
      is_active INTEGER NOT NULL DEFAULT 1,
      reset_token TEXT,
      reset_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2. user_roles
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('customer', 'owner', 'manager', 'order_staff', 'content_staff')),
      assigned_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, role)
    );

    -- 3. admin_permissions
    CREATE TABLE IF NOT EXISTS admin_permissions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'order_staff', 'content_staff')),
      permission_key TEXT NOT NULL,
      allowed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(role, permission_key)
    );

    -- 6. categories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_hi TEXT,
      slug TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL CHECK (department IN ('mens-wear', 'womens-wear', 'kids-wear', 'footwear')),
      parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT,
      image_url TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 4. products
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_hi TEXT,
      slug TEXT NOT NULL UNIQUE,
      sku_prefix TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      fabric_care TEXT,
      department TEXT NOT NULL CHECK (department IN ('mens-wear', 'womens-wear', 'kids-wear', 'footwear')),
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      subcategory_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      regular_price REAL NOT NULL CHECK (regular_price >= 0),
      discounted_price REAL CHECK (discounted_price IS NULL OR discounted_price >= 0),
      product_type TEXT NOT NULL DEFAULT 'Apparel',
      tags_json TEXT NOT NULL DEFAULT '[]',
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_best_seller INTEGER NOT NULL DEFAULT 0,
      is_new_arrival INTEGER NOT NULL DEFAULT 0,
      is_trending INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1,
      is_archived INTEGER NOT NULL DEFAULT 0,
      review_status TEXT NOT NULL DEFAULT 'approved',
      popularity_score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 5. product_images
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      alt_text TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      file_size_bytes INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 7. collections
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      banner_image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 8. collection_products
    CREATE TABLE IF NOT EXISTS collection_products (
      collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (collection_id, product_id)
    );

    -- 9. product_variants
    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      sku TEXT NOT NULL UNIQUE,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      color_hex TEXT DEFAULT '#141413',
      price_override REAL CHECK (price_override IS NULL OR price_override >= 0),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(product_id, size, color)
    );

    -- 10. inventory
    CREATE TABLE IF NOT EXISTS inventory (
      variant_id TEXT PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity_available INTEGER NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
      quantity_reserved INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
      low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 11. inventory_movements
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      change_amount INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('initial_stock', 'manual_adjustment', 'order_placed', 'order_cancelled', 'return_restocked', 'reconciliation')),
      reference_id TEXT,
      note TEXT,
      performed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 12. carts
    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      guest_token TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 13. cart_items
    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(cart_id, variant_id)
    );

    -- 14. wishlists
    CREATE TABLE IF NOT EXISTS wishlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 15. wishlist_items
    CREATE TABLE IF NOT EXISTS wishlist_items (
      wishlist_id TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (wishlist_id, product_id)
    );

    -- 16. addresses
    CREATE TABLE IF NOT EXISTS addresses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      address_line TEXT NOT NULL,
      locality TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      pincode TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 17. orders
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      invoice_number TEXT NOT NULL UNIQUE,
      idempotency_key TEXT UNIQUE,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_mobile TEXT NOT NULL,
      customer_email TEXT,
      shipping_address_json TEXT NOT NULL,
      billing_address_json TEXT NOT NULL,
      delivery_instructions TEXT,
      subtotal REAL NOT NULL CHECK (subtotal >= 0),
      discount_amount REAL NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      shipping_fee REAL NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
      tax_amount REAL NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      grand_total REAL NOT NULL CHECK (grand_total >= 0),
      coupon_code TEXT,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('COD', 'UPI_WHATSAPP', 'WHATSAPP_MANUAL', 'RAZORPAY')),
      payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (
        payment_status IN ('pending', 'awaiting_payment', 'payment_claimed', 'under_verification', 'paid', 'rejected', 'refunded', 'collected', 'failed')
      ),
      payment_reference TEXT,
      payment_claim_note TEXT,
      payment_verified_by TEXT,
      payment_verified_at TEXT,
      is_proforma INTEGER NOT NULL DEFAULT 0,
      order_source TEXT NOT NULL DEFAULT 'Website' CHECK (order_source IN ('Website', 'WhatsApp', 'Admin')),
      order_status TEXT NOT NULL DEFAULT 'Pending Confirmation' CHECK (
        order_status IN (
          'Pending Confirmation', 'Confirmed', 'Processing', 'Packed', 'Shipped',
          'Out for Delivery', 'Delivered', 'Cancellation Requested', 'Cancelled',
          'Return Requested', 'Returned', 'Refund Pending', 'Refunded'
        )
      ),
      courier_partner TEXT,
      tracking_number TEXT,
      tracking_url TEXT,
      shipped_at TEXT,
      expected_delivery_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 18. order_items
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
      product_title TEXT NOT NULL,
      sku TEXT NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      unit_price REAL NOT NULL CHECK (unit_price >= 0),
      line_total REAL NOT NULL CHECK (line_total >= 0)
    );

    -- 19. order_status_history
    CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      changed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      changed_by_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 20. payments
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('COD', 'UPI_WHATSAPP', 'MANUAL', 'RAZORPAY')),
      razorpay_order_id TEXT UNIQUE,
      razorpay_payment_id TEXT UNIQUE,
      razorpay_signature TEXT,
      amount REAL NOT NULL CHECK (amount >= 0),
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL CHECK (
        status IN ('created', 'pending', 'awaiting_payment', 'payment_claimed', 'under_verification', 'verified', 'rejected', 'failed', 'refunded', 'collected')
      ),
      raw_payload_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 21. coupons
    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
      discount_value REAL NOT NULL CHECK (discount_value > 0),
      min_order_amount REAL NOT NULL DEFAULT 0,
      max_discount_amount REAL,
      usage_limit INTEGER,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 22. coupon_redemptions
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id TEXT PRIMARY KEY,
      coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      discount_applied REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 23. reviews
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      reviewer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      is_verified_purchase INTEGER NOT NULL DEFAULT 0,
      is_approved INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(product_id, user_id)
    );

    -- 24. return_requests
    CREATE TABLE IF NOT EXISTS return_requests (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed')),
      admin_notes TEXT,
      reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 25. refund_records
    CREATE TABLE IF NOT EXISTS refund_records (
      id TEXT PRIMARY KEY,
      return_request_id TEXT REFERENCES return_requests(id) ON DELETE SET NULL,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      amount REAL NOT NULL CHECK (amount >= 0),
      refund_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processed', 'Failed')),
      reference_number TEXT,
      processed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 26. notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'in_app', 'contact_form', 'newsletter')),
      recipient TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'read')),
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 27. website_settings
    CREATE TABLE IF NOT EXISTS website_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 28. homepage_sections
    CREATE TABLE IF NOT EXISTS homepage_sections (
      id TEXT PRIMARY KEY,
      section_key TEXT NOT NULL UNIQUE,
      section_type TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      cta_label TEXT,
      cta_link TEXT,
      image_url TEXT,
      config_json TEXT NOT NULL DEFAULT '{}',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 29. banners
    CREATE TABLE IF NOT EXISTS banners (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      image_url TEXT NOT NULL,
      link_url TEXT,
      placement TEXT NOT NULL DEFAULT 'hero',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 30. serviceable_pincodes
    CREATE TABLE IF NOT EXISTS serviceable_pincodes (
      pincode TEXT PRIMARY KEY,
      area_name TEXT NOT NULL,
      town_name TEXT,
      city TEXT NOT NULL DEFAULT 'Bulandshahr',
      state TEXT NOT NULL DEFAULT 'Uttar Pradesh',
      radius_km REAL DEFAULT 25,
      min_order_value REAL DEFAULT 0,
      delivery_fee REAL NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
      free_delivery_above REAL,
      cod_allowed INTEGER NOT NULL DEFAULT 1,
      estimated_days TEXT NOT NULL DEFAULT '1-2 Days',
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    -- 31. shipping_methods
    CREATE TABLE IF NOT EXISTS shipping_methods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      base_fee REAL NOT NULL DEFAULT 0 CHECK (base_fee >= 0),
      estimated_time TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    -- 32. admin_activity_logs
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id TEXT PRIMARY KEY,
      admin_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      admin_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 33. analytics_events
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL CHECK (event_type IN ('product_view', 'add_to_cart', 'checkout_initiated', 'order_completed')),
      product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
      order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
      session_id TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_dept_pub ON products(department, is_published, is_archived);
    CREATE INDEX IF NOT EXISTS idx_variants_prod ON product_variants(product_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status, created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type, created_at);
  `);

  migrateLegacyConstraintsAndColumns();
}
