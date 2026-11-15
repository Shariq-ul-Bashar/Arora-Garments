import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './db.ts';

function uid() {
  return crypto.randomUUID();
}

export function seedDatabase() {
  const tx = db.transaction(() => {
    const existingSettings = db.prepare('SELECT COUNT(*) as c FROM website_settings').get() as { c: number };

    // 1. Default Website Settings (Inserted if key doesn't exist; never overwrites user edits)
    const defaultSettings: Record<string, unknown> = {
      business_info: {
        brand_name: 'ARORA GARMENTS',
        tagline: 'ULTIMATE FASHION DESTINATION',
        business_type: 'Family Fashion & Readymade Garments',
        address_line: 'CV59+RH9, Faislabad',
        city: 'Bulandshahr',
        state: 'Uttar Pradesh',
        pincode: '203001',
        country: 'India',
        primary_phone: '+91 9897694349',
        secondary_phone: '+91 9759147004',
        whatsapp_primary: '919897694349',
        whatsapp_secondary: '919759147004',
        instagram_1: 'https://www.instagram.com/arora_garments001/',
        instagram_2: 'https://www.instagram.com/arora._.garments/',
        operating_hours: 'Monday – Sunday, 10:00 AM – 8:30 PM',
        currency: 'INR',
        currency_symbol: '₹',
        timezone: 'Asia/Kolkata',
        announcement_text: 'Local Delivery across Bulandshahr, Sikandrabad, Shikarpur & Jahangirabad · Pan-India Orders via WhatsApp +91 9897694349',
        announcement_enabled: true,
        maps_directions_url: 'https://share.google/kfXnT0m9qZV5sQpdK',
      },
      invoice_settings: {
        gst_enabled: false,
        gstin: '',
        legal_name: '',
        seller_state: 'Uttar Pradesh',
        default_gst_rate: 0,
        tax_rate_percent: 0,
        tax_calculation_mode: 'inclusive',
        tax_label: 'GST (Included / As Applicable)',
        return_window_days: 7,
        footer_note: 'Thank you for shopping with ARORA GARMENTS, Bulandshahr. Retain this document for exchanges within our return window.',
      },
      branding: {
        main_logo_url: '',
        light_logo_url: '',
        dark_logo_url: '',
        favicon_url: '',
        logo_width: 160,
        logo_height: 40,
        logo_alignment: 'left',
      },
      appearance: {
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
      },
      payment_settings: {
        cod_enabled: true,
        upi_whatsapp_enabled: true,
        upi_id: '',
        upi_payee_name: 'ARORA GARMENTS',
        upi_qr_url: '',
        upi_instructions: 'Scan QR or pay via UPI app, download your Order Summary PDF, and send your payment screenshot on WhatsApp for manual verification by our store team.',
      },
    };

    const insertSetting = db.prepare('INSERT OR IGNORE INTO website_settings (key, value_json) VALUES (?, ?)');
    for (const [key, val] of Object.entries(defaultSettings)) {
      insertSetting.run(key, JSON.stringify(val));
    }

    // Non-destructively merge missing GST fields into existing invoice_settings without overwriting admin edits
    const invRow = db.prepare(`SELECT value_json FROM website_settings WHERE key = 'invoice_settings'`).get() as { value_json: string } | undefined;
    if (invRow) {
      try {
        const curInv = JSON.parse(invRow.value_json);
        const mergedInv = {
          gst_enabled: false,
          legal_name: '',
          seller_state: 'Uttar Pradesh',
          default_gst_rate: Number(curInv.tax_rate_percent || 0),
          tax_calculation_mode: 'inclusive',
          ...(defaultSettings.invoice_settings as object),
          ...curInv,
        };
        if (JSON.stringify(mergedInv) !== invRow.value_json) {
          db.prepare(`UPDATE website_settings SET value_json = ?, updated_at = datetime('now') WHERE key = 'invoice_settings'`).run(JSON.stringify(mergedInv));
        }
      } catch {}
    }

    // Non-destructively upgrade old default Maps search link to verified Google Maps share URL (preserves custom admin URLs)
    const bizRow = db.prepare(`SELECT value_json FROM website_settings WHERE key = 'business_info'`).get() as { value_json: string } | undefined;
    if (bizRow) {
      try {
        const curBiz = JSON.parse(bizRow.value_json);
        const oldDefaultSearch = 'https://www.google.com/maps/search/?api=1&query=CV59%2BRH9%2C+Faislabad%2C+Bulandshahr%2C+Uttar+Pradesh+203001';
        if (!curBiz.maps_directions_url || curBiz.maps_directions_url === oldDefaultSearch) {
          curBiz.maps_directions_url = 'https://share.google/kfXnT0m9qZV5sQpdK';
          db.prepare(`UPDATE website_settings SET value_json = ?, updated_at = datetime('now') WHERE key = 'business_info'`).run(JSON.stringify(curBiz));
        }
      } catch {}
    }

    // 2. Role Permissions Matrix (Only populate if empty)
    const permCount = (db.prepare('SELECT COUNT(*) as c FROM admin_permissions').get() as { c: number }).c;
    if (permCount === 0) {
      const roles = ['owner', 'manager', 'order_staff', 'content_staff'] as const;
      const allPerms = [
        'manage_admins', 'manage_permissions', 'manage_products', 'manage_inventory',
        'manage_orders', 'view_customers', 'manage_settings', 'view_analytics',
        'manage_integrations', 'manage_cms', 'manage_categories', 'manage_coupons'
      ];
      const roleMatrix: Record<string, string[]> = {
        owner: allPerms,
        manager: ['manage_products', 'manage_inventory', 'manage_orders', 'view_customers', 'view_analytics', 'manage_categories', 'manage_coupons', 'manage_settings'],
        order_staff: ['manage_orders', 'view_customers'],
        content_staff: ['manage_products', 'manage_cms', 'manage_categories'],
      };
      const insertPerm = db.prepare('INSERT OR IGNORE INTO admin_permissions (id, role, permission_key, allowed) VALUES (?, ?, ?, ?)');
      for (const role of roles) {
        for (const perm of allPerms) {
          insertPerm.run(uid(), role, perm, roleMatrix[role].includes(perm) ? 1 : 0);
        }
      }
    }

    // 3. Initial Owner Admin Account Bootstrap (Safe: only creates if no owner exists yet)
    const existingOwner = db
      .prepare(`SELECT user_id FROM user_roles WHERE role = 'owner' LIMIT 1`)
      .get() as { user_id: string } | undefined;
    let ownerId = existingOwner?.user_id;
    if (!ownerId) {
      const ownerEmail = process.env.ADMIN_SEED_EMAIL || 'owner@aroragarments.in';
      const ownerPassword = process.env.ADMIN_SEED_PASSWORD || 'AroraOwner@2026';
      ownerId = uid();
      db.prepare(
        'INSERT INTO profiles (id, full_name, phone, email, password_hash, preferred_language) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(ownerId, 'Arora Garments Owner', '+919897694349', ownerEmail, bcrypt.hashSync(ownerPassword, 10), 'en');
      db.prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)').run(uid(), ownerId, 'owner');
    }

    // 4. Departments & Subcategories
    const deptCategories: Array<{ dept: string; name: string; name_hi: string; subs: Array<[string, string]> }> = [
      {
        dept: 'mens-wear',
        name: "Men's Wear",
        name_hi: 'पुरुषों के परिधान',
        subs: [
          ['Shirts', 'शर्ट'],
          ['T-Shirts', 'टी-शर्ट'],
          ['Jeans', 'जीन्स'],
          ['Trousers', 'ट्राउज़र'],
          ['Kurtas', 'कुर्ता'],
          ['Kurta Pajama', 'कुर्ता पजामा'],
          ['Winter Wear', 'विंटर वियर'],
          ['Casual Wear', 'कैजुअल वियर'],
          ['Formal Wear', 'फॉर्मल वियर'],
          ['Trending Fashion', 'ट्रेंडिंग फैशन'],
        ],
      },
      {
        dept: 'womens-wear',
        name: "Women's Wear",
        name_hi: 'महिलाओं के परिधान',
        subs: [
          ['Tops', 'टॉप्स'],
          ['Jeans', 'जीन्स'],
          ['Ethnic Wear', 'एथनिक वियर'],
          ['Casual Wear', 'कैजुअल वियर'],
          ['Traditional Wear', 'ट्रेडिशनल वियर'],
          ['Seasonal Collections', 'सीज़नल कलेक्शन'],
          ['Trending Fashion', 'ट्रेंडिंग फैशन'],
        ],
      },
      {
        dept: 'kids-wear',
        name: 'Kids Wear',
        name_hi: 'बच्चों के परिधान',
        subs: [
          ['Boys Clothing', 'लड़कों के कपड़े'],
          ['Girls Clothing', 'लड़कियों के कपड़े'],
          ['Kids Casual Wear', 'किड्स कैजुअल वियर'],
          ['Kids Ethnic Wear', 'किड्स एथनिक वियर'],
          ['Seasonal Clothing', 'सीज़नल कपड़े'],
        ],
      },
      {
        dept: 'footwear',
        name: 'Footwear',
        name_hi: 'फुटवियर',
        subs: [
          ["Men's Footwear", 'पुरुष फुटवियर'],
          ["Women's Footwear", 'महिला फुटवियर'],
          ['Kids Footwear', 'किड्स फुटवियर'],
          ['Sneakers', 'स्नीकर्स'],
          ['Casual Shoes', 'कैजुअल शूज़'],
          ['Sandals', 'सैंडल'],
          ['Slippers', 'स्लीपर्स'],
          ['Formal Footwear', 'फॉर्मल फुटवियर'],
        ],
      },
    ];

    const deptImages: Record<string, string> = {
      'mens-wear': '/assets/catalog/collection_mens_fashion_1794594465072.jpg',
      'womens-wear': '/assets/catalog/collection_womens_ethnic_1794594449450.jpg',
      'kids-wear': '/assets/catalog/collection_kids_fashion_1794594449811.jpg',
      'footwear': '/assets/catalog/collection_footwear_edit_1794594449610.jpg',
    };

    const insertCat = db.prepare(
      'INSERT OR IGNORE INTO categories (id, name, name_hi, slug, department, parent_id, image_url, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)'
    );
    deptCategories.forEach((d, idx) => {
      const existingParent = db.prepare('SELECT id, image_url FROM categories WHERE slug = ?').get(d.dept) as { id: string; image_url: string | null } | undefined;
      const parentId = existingParent?.id || uid();
      if (!existingParent) {
        insertCat.run(parentId, d.name, d.name_hi, d.dept, d.dept, null, deptImages[d.dept], idx + 1);
      } else if (!existingParent.image_url || existingParent.image_url.startsWith('/assets/catalog/dept_')) {
        db.prepare('UPDATE categories SET image_url = ? WHERE id = ?').run(deptImages[d.dept], existingParent.id);
      }
      d.subs.forEach(([subName, subHi], sIdx) => {
        const subSlug = `${d.dept}-${subName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        insertCat.run(uid(), subName, subHi, subSlug, d.dept, parentId, deptImages[d.dept], sIdx + 1);
      });
    });

    const allCats = db.prepare('SELECT id, slug FROM categories').all() as Array<{ id: string; slug: string }>;
    const categoryMap = new Map<string, string>(allCats.map((c) => [c.slug, c.id]));

    // 5. Collections
    const defaultCollections = [
      { name: 'New Arrivals', slug: 'new-arrivals', desc: 'Freshly stocked apparel & footwear for the 2026 season.', img: '/assets/catalog/collection_mens_fashion_1794594465072.jpg' },
      { name: 'Trending Now', slug: 'trending', desc: 'Most requested contemporary silhouettes in Bulandshahr.', img: '/assets/catalog/collection_womens_ethnic_1794594449450.jpg' },
      { name: 'Best Sellers', slug: 'best-sellers', desc: 'Customer favorites across Men, Women, Kids & Footwear.', img: '/assets/catalog/collection_footwear_edit_1794594449610.jpg' },
      { name: 'Seasonal Collections', slug: 'seasonal', desc: 'Festive ethnic wear, transitional layering & everyday essentials.', img: '/assets/catalog/collection_seasonal_festive_1794594450366.jpg' },
    ];
    const insertCol = db.prepare('INSERT OR IGNORE INTO collections (id, name, slug, description, banner_image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    defaultCollections.forEach((c, i) => {
      insertCol.run(uid(), c.name, c.slug, c.desc, c.img, i + 1);
      db.prepare('UPDATE collections SET banner_image_url = ? WHERE slug = ? AND (banner_image_url IS NULL OR banner_image_url = \'\')').run(c.img, c.slug);
    });

    const colRows = db.prepare('SELECT id, slug FROM collections').all() as Array<{ id: string; slug: string }>;
    const colMap = new Map<string, string>(colRows.map((c) => [c.slug, c.id]));

    // 6. Expanded Serviceable PIN Codes (~20-30 km around CV59+RH9, Faislabad, Bulandshahr 203001)
    const pincodes = [
      { pincode: '203001', area: 'Faislabad, DM Colony & Bulandshahr City', town: 'Bulandshahr', radius: 5, minOrder: 0, fee: 30, freeAbove: 999, days: 'Same / Next Day' },
      { pincode: '203002', area: 'Bulandshahr Civil Lines & Industrial Area', town: 'Bulandshahr', radius: 10, minOrder: 0, fee: 40, freeAbove: 1199, days: '1-2 Days' },
      { pincode: '203205', area: 'Sikandrabad Main Market & GT Road', town: 'Sikandrabad', radius: 22, minOrder: 499, fee: 60, freeAbove: 1499, days: '1-2 Days' },
      { pincode: '203395', area: 'Shikarpur Town & Surrounding Villages', town: 'Shikarpur', radius: 24, minOrder: 499, fee: 60, freeAbove: 1499, days: '1-2 Days' },
      { pincode: '203394', area: 'Jahangirabad & Anupshahr Bypass', town: 'Jahangirabad', radius: 26, minOrder: 499, fee: 70, freeAbove: 1599, days: '2 Days' },
      { pincode: '203131', area: 'Khurja Junction & City Zone', town: 'Khurja', radius: 24, minOrder: 499, fee: 70, freeAbove: 1499, days: '2-3 Days' },
      { pincode: '203129', area: 'Anupshahr Road & Siyana Link', town: 'Bulandshahr Rural', radius: 20, minOrder: 399, fee: 60, freeAbove: 1299, days: '1-2 Days' },
      { pincode: '203407', area: 'Gulawati Market & Tehsil Road', town: 'Gulawati', radius: 25, minOrder: 499, fee: 70, freeAbove: 1499, days: '2 Days' },
      { pincode: '203408', area: 'Syana Market & Garh Road', town: 'Syana', radius: 29, minOrder: 599, fee: 80, freeAbove: 1799, days: '2-3 Days' },
    ];
    const insertPin = db.prepare(
      `INSERT OR IGNORE INTO serviceable_pincodes (
        pincode, area_name, town_name, city, state, radius_km, min_order_value, delivery_fee, free_delivery_above, cod_allowed, estimated_days, is_active
      ) VALUES (?, ?, ?, ?, 'Uttar Pradesh', ?, ?, ?, ?, 1, ?, 1)`
    );
    pincodes.forEach((p) => insertPin.run(p.pincode, p.area, p.town, p.town, p.radius, p.minOrder, p.fee, p.freeAbove, p.days));

    // Update town_name on older rows if missing
    db.prepare(`UPDATE serviceable_pincodes SET town_name = COALESCE(town_name, city)`).run();

    // 7. Shipping Methods
    if ((db.prepare('SELECT COUNT(*) as c FROM shipping_methods').get() as { c: number }).c === 0) {
      const insertShip = db.prepare('INSERT INTO shipping_methods (id, name, description, base_fee, estimated_time, is_active, sort_order) VALUES (?, ?, ?, ?, ?, 1, ?)');
      insertShip.run(uid(), 'Local Bulandshahr & Zone Delivery (20–30 km)', 'Doorstep delivery across Bulandshahr, Sikandrabad, Shikarpur, Jahangirabad & nearby PINs.', 40, '1–2 Days', 1);
      insertShip.run(uid(), 'Store Pickup — Faislabad Showroom', 'Collect your packed order directly from CV59+RH9, Faislabad showroom.', 0, 'Same Day (10 AM – 8:30 PM)', 2);
    }

    // 8. Verified Initial Core Catalog (only on completely fresh DB)
    if (existingSettings.c === 0) {
      const coreProducts = [
        {
          title: 'Tailored Slate Oxford Cotton Shirt',
          title_hi: 'टेलर्ड स्लेट ऑक्सफोर्ड कॉटन शर्ट',
          slug: 'tailored-slate-oxford-cotton-shirt',
          sku_prefix: 'AG-MSH-001',
          description: 'Structured breathable 100% cotton oxford shirt tailored for crisp everyday smart-casual wear.',
          fabric_care: '100% Combed Cotton · Machine wash cold, line dry in shade.',
          department: 'mens-wear',
          subSlug: 'mens-wear-shirts',
          regular_price: 1699,
          discounted_price: 1399,
          product_type: 'Shirt',
          tags: ['cotton', 'oxford', 'smart-casual', 'mens'],
          featured: 1, best: 1, newArr: 1, trending: 1,
          image: '/assets/catalog/dept_mens_shirt_1794585864563.jpg',
          variants: [
            { size: 'M', color: 'Slate Blue', hex: '#4A6278', stock: 12 },
            { size: 'L', color: 'Slate Blue', hex: '#4A6278', stock: 9 },
            { size: 'XL', color: 'Slate Blue', hex: '#4A6278', stock: 6 },
            { size: 'M', color: 'Ivory', hex: '#F3EFE6', stock: 8 },
          ],
        },
        {
          title: 'Classic Ivory Handloom Cotton Kurta',
          title_hi: 'क्लासिक आइवरी हैंडलूम कॉटन कुर्ता',
          slug: 'classic-ivory-handloom-cotton-kurta',
          sku_prefix: 'AG-MKR-002',
          description: 'Mandarin-collar straight cotton kurta finished with wooden button placket for festive and family gatherings.',
          fabric_care: '100% Organic Cotton · Gentle hand wash or cold delicate cycle.',
          department: 'mens-wear',
          subSlug: 'mens-wear-kurtas',
          regular_price: 1899,
          discounted_price: 1499,
          product_type: 'Kurta',
          tags: ['kurta', 'ethnic', 'festive', 'cotton'],
          featured: 1, best: 1, newArr: 1, trending: 0,
          image: '/assets/catalog/prod_mens_kurta_1794585866377.jpg',
          variants: [
            { size: 'S', color: 'Ivory', hex: '#F3EFE6', stock: 7 },
            { size: 'M', color: 'Ivory', hex: '#F3EFE6', stock: 14 },
            { size: 'L', color: 'Ivory', hex: '#F3EFE6', stock: 11 },
            { size: 'XL', color: 'Ivory', hex: '#F3EFE6', stock: 4 },
          ],
        },
        {
          title: 'Terracotta Zari-Border Silk Blend Kurta Set',
          title_hi: 'टेराकोटा ज़री-बॉर्डर सिल्क ब्लेंड कुर्ता सेट',
          slug: 'terracotta-zari-border-silk-blend-kurta-set',
          sku_prefix: 'AG-WET-003',
          description: 'Three-piece ethnic ensemble featuring subtle woven zari detailing, matching straight trousers, and sheer organza dupatta.',
          fabric_care: 'Chanderi Silk Blend · Dry clean recommended.',
          department: 'womens-wear',
          subSlug: 'womens-wear-ethnic-wear',
          regular_price: 3499,
          discounted_price: 2899,
          product_type: 'Ethnic Set',
          tags: ['ethnic', 'festive', 'traditional', 'kurta-set'],
          featured: 1, best: 1, newArr: 1, trending: 1,
          image: '/assets/catalog/dept_womens_ethnic_1794585864304.jpg',
          variants: [
            { size: 'S', color: 'Terracotta', hex: '#9A462B', stock: 6 },
            { size: 'M', color: 'Terracotta', hex: '#9A462B', stock: 10 },
            { size: 'L', color: 'Terracotta', hex: '#9A462B', stock: 8 },
            { size: 'XL', color: 'Terracotta', hex: '#9A462B', stock: 3 },
          ],
        },
        {
          title: 'Sage Relaxed Linen Top & Raw Indigo Denim',
          title_hi: 'सेज लिनेन टॉप और रॉ इंडिगो डेनिम',
          slug: 'sage-relaxed-linen-top',
          sku_prefix: 'AG-WTP-004',
          description: 'Breathable sage-green linen-cotton boxy top styled for effortless all-day comfort across seasons.',
          fabric_care: '55% Linen, 45% Cotton · Machine wash cold.',
          department: 'womens-wear',
          subSlug: 'womens-wear-tops',
          regular_price: 1299,
          discounted_price: null,
          product_type: 'Top',
          tags: ['tops', 'casual', 'linen', 'womens'],
          featured: 1, best: 0, newArr: 1, trending: 1,
          image: '/assets/catalog/prod_womens_casual_1794585866132.jpg',
          variants: [
            { size: 'S', color: 'Sage Green', hex: '#8A9A82', stock: 9 },
            { size: 'M', color: 'Sage Green', hex: '#8A9A82', stock: 12 },
            { size: 'L', color: 'Sage Green', hex: '#8A9A82', stock: 7 },
          ],
        },
        {
          title: 'Kids Mustard Embroidered Kurta & Denim Jacket Set',
          title_hi: 'किड्स मस्टर्ड कुर्ता और डेनिम जैकेट सेट',
          slug: 'kids-mustard-kurta-denim-jacket-set',
          sku_prefix: 'AG-KDS-005',
          description: 'Versatile festive-casual pairing combining soft embroidered mustard cotton kurta with structured washed denim layer.',
          fabric_care: '100% Soft Cotton · Gentle machine wash.',
          department: 'kids-wear',
          subSlug: 'kids-wear-kids-ethnic-wear',
          regular_price: 1799,
          discounted_price: 1449,
          product_type: 'Kids Set',
          tags: ['kids', 'boys', 'ethnic', 'casual', 'denim'],
          featured: 1, best: 1, newArr: 1, trending: 1,
          image: '/assets/catalog/dept_kids_fashion_1794585864186.jpg',
          variants: [
            { size: '4-5Y', color: 'Mustard & Indigo', hex: '#C68E35', stock: 10 },
            { size: '6-7Y', color: 'Mustard & Indigo', hex: '#C68E35', stock: 8 },
            { size: '8-9Y', color: 'Mustard & Indigo', hex: '#C68E35', stock: 6 },
            { size: '10-11Y', color: 'Mustard & Indigo', hex: '#C68E35', stock: 4 },
          ],
        },
        {
          title: 'Architectural Off-White Leather Sneakers',
          title_hi: 'ऑफ-व्हाइट लेदर स्नीकर्स',
          slug: 'architectural-off-white-leather-sneakers',
          sku_prefix: 'AG-FWS-006',
          description: 'Clean low-top court sneakers crafted with cushioned footbed and durable gum-rubber sole.',
          fabric_care: 'Wipe clean with damp cloth · Use suede/leather protector.',
          department: 'footwear',
          subSlug: 'footwear-sneakers',
          regular_price: 2499,
          discounted_price: 1999,
          product_type: 'Sneakers',
          tags: ['footwear', 'sneakers', 'casual', 'mens'],
          featured: 1, best: 1, newArr: 1, trending: 1,
          image: '/assets/catalog/dept_footwear_collection_1794585864961.jpg',
          variants: [
            { size: 'UK 7', color: 'Off-White Gum', hex: '#EFECE6', stock: 6 },
            { size: 'UK 8', color: 'Off-White Gum', hex: '#EFECE6', stock: 10 },
            { size: 'UK 9', color: 'Off-White Gum', hex: '#EFECE6', stock: 8 },
            { size: 'UK 10', color: 'Off-White Gum', hex: '#EFECE6', stock: 4 },
          ],
        },
        {
          title: 'Handcrafted Cognac Leather Penny Loafers',
          title_hi: 'हैंडक्राफ्टेड कॉन्यैक लेदर लोफर्स',
          slug: 'handcrafted-cognac-leather-penny-loafers',
          sku_prefix: 'AG-FWF-007',
          description: 'Classic burnished tan formal penny loafers suited for weddings, office tailoring, and festive kurtas.',
          fabric_care: 'Polish with neutral wax cream · Store with shoe trees.',
          department: 'footwear',
          subSlug: 'footwear-formal-footwear',
          regular_price: 2999,
          discounted_price: 2499,
          product_type: 'Formal Shoes',
          tags: ['footwear', 'formal', 'loafers', 'leather'],
          featured: 1, best: 0, newArr: 0, trending: 1,
          image: '/assets/catalog/prod_formal_footwear_1794585865848.jpg',
          variants: [
            { size: 'UK 7', color: 'Cognac Brown', hex: '#8B4A24', stock: 5 },
            { size: 'UK 8', color: 'Cognac Brown', hex: '#8B4A24', stock: 7 },
            { size: 'UK 9', color: 'Cognac Brown', hex: '#8B4A24', stock: 6 },
          ],
        },
      ];

      coreProducts.forEach((p, idx) => {
        const pId = uid();
        const catId = categoryMap.get(p.department) || null;
        const subId = categoryMap.get(p.subSlug) || null;
        db.prepare(`
          INSERT OR IGNORE INTO products (
            id, title, title_hi, slug, sku_prefix, description, fabric_care, department,
            category_id, subcategory_id, regular_price, discounted_price, product_type,
            tags_json, is_featured, is_best_seller, is_new_arrival, is_trending, is_published, review_status, popularity_score
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'approved', ?)
        `).run(
          pId, p.title, p.title_hi, p.slug, p.sku_prefix, p.description, p.fabric_care,
          p.department, catId, subId, p.regular_price, p.discounted_price, p.product_type,
          JSON.stringify(p.tags), p.featured, p.best, p.newArr, p.trending, 100 - idx * 5
        );
        db.prepare('INSERT INTO product_images (id, product_id, image_url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, 0, 1)').run(
          uid(), pId, p.image, p.title
        );
        p.variants.forEach((v) => {
          const vId = uid();
          const sku = `${p.sku_prefix}-${v.size.replace(/\s+/g, '')}-${v.color.slice(0, 3).toUpperCase()}`;
          db.prepare('INSERT INTO product_variants (id, product_id, sku, size, color, color_hex) VALUES (?, ?, ?, ?, ?, ?)').run(
            vId, pId, sku, v.size, v.color, v.hex
          );
          db.prepare('INSERT INTO inventory (variant_id, quantity_available, quantity_reserved, low_stock_threshold) VALUES (?, ?, 0, 5)').run(vId, v.stock);
          db.prepare('INSERT INTO inventory_movements (id, variant_id, change_amount, reason, note, performed_by) VALUES (?, ?, ?, ?, ?, ?)').run(
            uid(), vId, v.stock, 'initial_stock', 'Initial storefront catalog stock', ownerId
          );
        });
      });
    }

    // 9. Expanded Starter Catalogue (Ensure 10+ items per department — marked DRAFT / NEEDS REVIEW & is_published = 0!)
    // So unverified sample prices/stock are NEVER exposed as live purchasable inventory until owner reviews/publishes in Admin.
    const starterDraftTemplates: Array<{
      dept: 'mens-wear' | 'womens-wear' | 'kids-wear' | 'footwear';
      subSlug: string;
      title: string;
      title_hi: string;
      sku_prefix: string;
      product_type: string;
      price: number;
      sizes: string[];
      color: string;
      hex: string;
      image: string;
      desc: string;
    }> = [
      // Men's Wear (9 additional drafts + 2 core = 11)
      { dept: 'mens-wear', subSlug: 'mens-wear-shirts', title: 'Crisp White Formal Poplin Shirt (Draft Starter)', title_hi: 'व्हाइट फॉर्मल पॉपलिन शर्ट', sku_prefix: 'AG-STR-M01', product_type: 'Formal Shirt', price: 1499, sizes: ['M', 'L', 'XL'], color: 'White', hex: '#F9FAFB', image: '/assets/catalog/dept_mens_shirt_1794585864563.jpg', desc: 'Starter draft entry. Verify store MRP, sizes, and stock before publishing.' },
      { dept: 'mens-wear', subSlug: 'mens-wear-t-shirts', title: 'Combed Cotton Polo T-Shirt Navy (Draft Starter)', title_hi: 'नेवी कॉटन पोलो टी-शर्ट', sku_prefix: 'AG-STR-M02', product_type: 'T-Shirt', price: 899, sizes: ['S', 'M', 'L', 'XL'], color: 'Navy', hex: '#1E293B', image: '/assets/catalog/dept_mens_shirt_1794585864563.jpg', desc: 'Starter draft entry. Verify store MRP, sizes, and stock before publishing.' },
      { dept: 'mens-wear', subSlug: 'mens-wear-jeans', title: 'Slim-Straight Dark Indigo Denim Jeans (Draft Starter)', title_hi: 'डार्क इंडिगो डेनिम जीन्स', sku_prefix: 'AG-STR-M03', product_type: 'Jeans', price: 1899, sizes: ['30', '32', '34', '36'], color: 'Indigo', hex: '#1E3A5F', image: '/assets/catalog/dept_mens_shirt_1794585864563.jpg', desc: 'Starter draft entry. Verify waist sizes and stock before publishing.' },
      { dept: 'mens-wear', subSlug: 'mens-wear-trousers', title: 'Tailored Charcoal Chino Trousers (Draft Starter)', title_hi: 'चारकोल चिनो ट्राउज़र', sku_prefix: 'AG-STR-M04', product_type: 'Trousers', price: 1599, sizes: ['30', '32', '34', '36'], color: 'Charcoal', hex: '#374151', image: '/assets/catalog/dept_mens_shirt_1794585864563.jpg', desc: 'Starter draft entry. Verify trouser sizes and MRP before publishing.' },
      { dept: 'mens-wear', subSlug: 'mens-wear-kurta-pajama', title: 'Festive Jacquard Kurta Pajama Set (Draft Starter)', title_hi: 'फेस्टिव जैक्वार्ड कुर्ता पजामा सेट', sku_prefix: 'AG-STR-M05', product_type: 'Kurta Pajama', price: 2499, sizes: ['M', 'L', 'XL'], color: 'Beige Gold', hex: '#D6C7A9', image: '/assets/catalog/prod_mens_kurta_1794585866377.jpg', desc: 'Starter draft entry. Verify festive set stock before publishing.' },
      { dept: 'mens-wear', subSlug: 'mens-wear-winter-wear', title: 'Quilted Olive Nehru Winter Jacket (Draft Starter)', title_hi: 'ऑलिव नेहरू विंटर जैकेट', sku_prefix: 'AG-STR-M06', product_type: 'Winter Wear', price: 2299, sizes: ['M', 'L', 'XL'], color: 'Olive', hex: '#4D5D43', image: '/assets/catalog/prod_mens_kurta_1794585866377.jpg', desc: 'Starter draft entry. Verify seasonal jacket pricing and stock before publishing.' },
      { dept: 'mens-wear', subSlug: 'mens-wear-casual-wear', title: 'Checked Flannel Everyday Overshirt (Draft Starter)', title_hi: 'चेक्ड कैजुअल ओवरशर्ट', sku_prefix: 'AG-STR-M07', product_type: 'Casual Shirt', price: 1399, sizes: ['M', 'L', 'XL'], color: 'Rust Check', hex: '#8C5A3C', image: '/assets/catalog/dept_mens_shirt_1794585864563.jpg', desc: 'Starter draft entry. Verify store price and publish.' },
      { dept: 'mens-wear', subSlug: 'mens-wear-formal-wear', title: 'Wrinkle-Resistant Office Pleated Trouser (Draft Starter)', title_hi: 'फॉर्मल ऑफिस पैंट', sku_prefix: 'AG-STR-M08', product_type: 'Formal Trouser', price: 1699, sizes: ['30', '32', '34'], color: 'Black', hex: '#111827', image: '/assets/catalog/dept_mens_shirt_1794585864563.jpg', desc: 'Starter draft entry. Verify store price and publish.' },
      { dept: 'mens-wear', subSlug: 'mens-wear-trending-fashion', title: 'Relaxed Cuban-Collar Resort Shirt (Draft Starter)', title_hi: 'क्यूबन-कॉलर समर शर्ट', sku_prefix: 'AG-STR-M09', product_type: 'Resort Shirt', price: 1299, sizes: ['M', 'L'], color: 'Sage', hex: '#6B7F6E', image: '/assets/catalog/dept_mens_shirt_1794585864563.jpg', desc: 'Starter draft entry. Verify store price and publish.' },

      // Women's Wear (9 additional drafts + 2 core = 11)
      { dept: 'womens-wear', subSlug: 'womens-wear-tops', title: 'Embroidered Cotton Schiffli Peplum Top (Draft Starter)', title_hi: 'एम्ब्रॉयडर्ड कॉटन पेप्लम टॉप', sku_prefix: 'AG-STR-W01', product_type: 'Top', price: 1199, sizes: ['S', 'M', 'L'], color: 'Ivory', hex: '#F3EFE6', image: '/assets/catalog/prod_womens_casual_1794585866132.jpg', desc: 'Starter draft entry. Verify store MRP and stock before publishing.' },
      { dept: 'womens-wear', subSlug: 'womens-wear-jeans', title: 'High-Rise Straight Fit Ankle Denim (Draft Starter)', title_hi: 'हाई-राइज़ स्ट्रेट डेनिम जीन्स', sku_prefix: 'AG-STR-W02', product_type: 'Jeans', price: 1699, sizes: ['28', '30', '32', '34'], color: 'Mid Wash', hex: '#4B6B94', image: '/assets/catalog/prod_womens_casual_1794585866132.jpg', desc: 'Starter draft entry. Verify waist sizing and stock before publishing.' },
      { dept: 'womens-wear', subSlug: 'womens-wear-ethnic-wear', title: 'Block-Print Straight Cotton Kurti Set (Draft Starter)', title_hi: 'ब्लॉक-प्रिंट कॉटन कुर्ती सेट', sku_prefix: 'AG-STR-W03', product_type: 'Kurti Set', price: 1999, sizes: ['S', 'M', 'L', 'XL'], color: 'Maroon', hex: '#7F1D1D', image: '/assets/catalog/dept_womens_ethnic_1794585864304.jpg', desc: 'Starter draft entry. Verify store pricing and stock before publishing.' },
      { dept: 'womens-wear', subSlug: 'womens-wear-traditional-wear', title: 'Banarasi Brocade Festive Anarkali Suit (Draft Starter)', title_hi: 'बनारसी फेस्टिव अनारकली सूट', sku_prefix: 'AG-STR-W04', product_type: 'Anarkali Set', price: 3799, sizes: ['M', 'L', 'XL'], color: 'Crimson', hex: '#9F1239', image: '/assets/catalog/dept_womens_ethnic_1794585864304.jpg', desc: 'Starter draft entry. Verify festive collection MRP before publishing.' },
      { dept: 'womens-wear', subSlug: 'womens-wear-casual-wear', title: 'Soft Modal Everyday Co-Ord Lounge Set (Draft Starter)', title_hi: 'कैजुअल कॉ-ऑर्ड सेट', sku_prefix: 'AG-STR-W05', product_type: 'Co-ord Set', price: 1799, sizes: ['S', 'M', 'L'], color: 'Sand', hex: '#D6C7B2', image: '/assets/catalog/prod_womens_casual_1794585866132.jpg', desc: 'Starter draft entry. Verify stock before publishing.' },
      { dept: 'womens-wear', subSlug: 'womens-wear-seasonal-collections', title: 'Woolen Shawl-Collar Winter Cardigan (Draft Starter)', title_hi: 'वूलन विंटर कार्डिगन', sku_prefix: 'AG-STR-W06', product_type: 'Cardigan', price: 1899, sizes: ['M', 'L', 'XL'], color: 'Camel', hex: '#B48A5A', image: '/assets/catalog/prod_womens_casual_1794585866132.jpg', desc: 'Starter draft entry. Verify seasonal stock before publishing.' },
      { dept: 'womens-wear', subSlug: 'womens-wear-trending-fashion', title: 'Floral Tiered Georgette Midi Dress (Draft Starter)', title_hi: 'फ्लोरल मिडी ड्रेस', sku_prefix: 'AG-STR-W07', product_type: 'Dress', price: 2199, sizes: ['S', 'M', 'L'], color: 'Teal', hex: '#0F766E', image: '/assets/catalog/prod_womens_casual_1794585866132.jpg', desc: 'Starter draft entry. Verify store price before publishing.' },
      { dept: 'womens-wear', subSlug: 'womens-wear-ethnic-wear', title: 'Pastel Chikankari Lucknowi Straight Kurti (Draft Starter)', title_hi: 'पेस्टल चिकनकारी कुर्ती', sku_prefix: 'AG-STR-W08', product_type: 'Kurti', price: 1399, sizes: ['S', 'M', 'L', 'XL'], color: 'Rose Ivory', hex: '#E6D5D2', image: '/assets/catalog/dept_womens_ethnic_1794585864304.jpg', desc: 'Starter draft entry. Verify pricing before publishing.' },
      { dept: 'womens-wear', subSlug: 'womens-wear-traditional-wear', title: 'Gota-Patti Festive Sharara Ensemble (Draft Starter)', title_hi: 'गोटा-पत्ती फेस्टिव शरारा सेट', sku_prefix: 'AG-STR-W09', product_type: 'Sharara Set', price: 3299, sizes: ['S', 'M', 'L'], color: 'Mustard Gold', hex: '#C68E35', image: '/assets/catalog/dept_womens_ethnic_1794585864304.jpg', desc: 'Starter draft entry. Verify pricing and stock before publishing.' },

      // Kids Wear (9 additional drafts + 1 core = 10)
      { dept: 'kids-wear', subSlug: 'kids-wear-boys-clothing', title: 'Boys Checked Cotton Shirt & Chino Shorts (Draft Starter)', title_hi: 'बॉयज़ शर्ट और शॉर्ट्स सेट', sku_prefix: 'AG-STR-K01', product_type: 'Boys Set', price: 1099, sizes: ['4-5Y', '6-7Y', '8-9Y'], color: 'Sky Blue', hex: '#3B82F6', image: '/assets/catalog/dept_kids_fashion_1794585864186.jpg', desc: 'Starter draft entry. Verify kids sizes and MRP before publishing.' },
      { dept: 'kids-wear', subSlug: 'kids-wear-girls-clothing', title: 'Girls Embroidered Cotton Frock Dress (Draft Starter)', title_hi: 'गर्ल्स कॉटन फ्रॉक ड्रेस', sku_prefix: 'AG-STR-K02', product_type: 'Frock Dress', price: 1299, sizes: ['3-4Y', '5-6Y', '7-8Y'], color: 'Blush Pink', hex: '#EC4899', image: '/assets/catalog/dept_kids_fashion_1794585864186.jpg', desc: 'Starter draft entry. Verify pricing before publishing.' },
      { dept: 'kids-wear', subSlug: 'kids-wear-kids-casual-wear', title: 'Kids Graphic Fleece Sweatshirt & Jogger Set (Draft Starter)', title_hi: 'किड्स स्वेटशर्ट और जॉगर सेट', sku_prefix: 'AG-STR-K03', product_type: 'Track Set', price: 1399, sizes: ['4-5Y', '6-7Y', '8-9Y'], color: 'Heather Grey', hex: '#6B7280', image: '/assets/catalog/dept_kids_fashion_1794585864186.jpg', desc: 'Starter draft entry. Verify stock before publishing.' },
      { dept: 'kids-wear', subSlug: 'kids-wear-kids-ethnic-wear', title: 'Girls Festive Lehenga Choli Set (Draft Starter)', title_hi: 'गर्ल्स फेस्टिव लहंगा चोली', sku_prefix: 'AG-STR-K04', product_type: 'Kids Ethnic', price: 1999, sizes: ['4-5Y', '6-7Y', '8-9Y'], color: 'Crimson Gold', hex: '#9F1239', image: '/assets/catalog/dept_kids_fashion_1794585864186.jpg', desc: 'Starter draft entry. Verify pricing before publishing.' },
      { dept: 'kids-wear', subSlug: 'kids-wear-kids-ethnic-wear', title: 'Boys Silk-Blend Kurta Dhoti Festive Set (Draft Starter)', title_hi: 'बॉयज़ कुर्ता धोती सेट', sku_prefix: 'AG-STR-K05', product_type: 'Kids Ethnic', price: 1599, sizes: ['3-4Y', '5-6Y', '7-8Y'], color: 'Cream Gold', hex: '#EDE5D5', image: '/assets/catalog/dept_kids_fashion_1794585864186.jpg', desc: 'Starter draft entry. Verify pricing before publishing.' },
      { dept: 'kids-wear', subSlug: 'kids-wear-seasonal-clothing', title: 'Kids Hooded Puffer Winter Jacket (Draft Starter)', title_hi: 'किड्स विंटर पफर जैकेट', sku_prefix: 'AG-STR-K06', product_type: 'Winter Jacket', price: 1699, sizes: ['4-5Y', '6-7Y', '8-9Y', '10-11Y'], color: 'Navy Orange', hex: '#1E3A8A', image: '/assets/catalog/dept_kids_fashion_1794585864186.jpg', desc: 'Starter draft entry. Verify seasonal stock before publishing.' },
      { dept: 'kids-wear', subSlug: 'kids-wear-boys-clothing', title: 'Boys Washed Stretch Denim Jeans (Draft Starter)', title_hi: 'बॉयज़ डेनिम जीन्स', sku_prefix: 'AG-STR-K07', product_type: 'Kids Jeans', price: 999, sizes: ['4-5Y', '6-7Y', '8-9Y', '10-11Y'], color: 'Indigo', hex: '#1D4ED8', image: '/assets/catalog/dept_kids_fashion_1794585864186.jpg', desc: 'Starter draft entry. Verify pricing before publishing.' },
      { dept: 'kids-wear', subSlug: 'kids-wear-girls-clothing', title: 'Girls Denim Dungaree & Cotton Tee (Draft Starter)', title_hi: 'गर्ल्स डेनिम डंगरी सेट', sku_prefix: 'AG-STR-K08', product_type: 'Dungaree Set', price: 1349, sizes: ['4-5Y', '6-7Y', '8-9Y'], color: 'Light Wash', hex: '#60A5FA', image: '/assets/catalog/dept_kids_fashion_1794585864186.jpg', desc: 'Starter draft entry. Verify stock before publishing.' },
      { dept: 'kids-wear', subSlug: 'kids-wear-kids-casual-wear', title: 'Junior Cotton T-Shirt Pack (Set of 2) (Draft Starter)', title_hi: 'जूनियर कॉटन टी-शर्ट पैक', sku_prefix: 'AG-STR-K09', product_type: 'T-Shirt Pack', price: 799, sizes: ['4-5Y', '6-7Y', '8-9Y'], color: 'Multi', hex: '#10B981', image: '/assets/catalog/dept_kids_fashion_1794585864186.jpg', desc: 'Starter draft entry. Verify pricing before publishing.' },

      // Footwear (9 additional drafts + 2 core = 11)
      { dept: 'footwear', subSlug: 'footwear-sneakers', title: 'Urban Chunky Retro Running Sneakers (Draft Starter)', title_hi: 'अर्बन रेट्रो स्नीकर्स', sku_prefix: 'AG-STR-F01', product_type: 'Sneakers', price: 2299, sizes: ['UK 7', 'UK 8', 'UK 9', 'UK 10'], color: 'Stone Grey', hex: '#9CA3AF', image: '/assets/catalog/dept_footwear_collection_1794585864961.jpg', desc: 'Starter draft entry. Verify UK sizes and MRP before publishing.' },
      { dept: 'footwear', subSlug: 'footwear-casual-shoes', title: 'Canvas Everyday Slip-On Casual Shoes (Draft Starter)', title_hi: 'कैनवास स्लिप-ऑन शूज़', sku_prefix: 'AG-STR-F02', product_type: 'Casual Shoes', price: 1199, sizes: ['UK 7', 'UK 8', 'UK 9', 'UK 10'], color: 'Olive Canvas', hex: '#4B5548', image: '/assets/catalog/dept_footwear_collection_1794585864961.jpg', desc: 'Starter draft entry. Verify pricing before publishing.' },
      { dept: 'footwear', subSlug: 'footwear-formal-footwear', title: 'Black Lace-Up Classic Derby Formal Shoes (Draft Starter)', title_hi: 'ब्लैक फॉर्मल डर्बी शूज़', sku_prefix: 'AG-STR-F03', product_type: 'Formal Shoes', price: 2699, sizes: ['UK 7', 'UK 8', 'UK 9', 'UK 10'], color: 'Black', hex: '#111827', image: '/assets/catalog/prod_formal_footwear_1794585865848.jpg', desc: 'Starter draft entry. Verify pricing before publishing.' },
      { dept: 'footwear', subSlug: 'footwear-mens-footwear', title: 'Tan Leather Ethnic Mojari / Jutti (Draft Starter)', title_hi: 'मेन्स एथनिक मोजरी जूती', sku_prefix: 'AG-STR-F04', product_type: 'Ethnic Footwear', price: 1299, sizes: ['UK 7', 'UK 8', 'UK 9', 'UK 10'], color: 'Tan', hex: '#B45309', image: '/assets/catalog/prod_formal_footwear_1794585865848.jpg', desc: 'Starter draft entry. Verify pricing before publishing.' },
      { dept: 'footwear', subSlug: 'footwear-womens-footwear', title: 'Womens Cushioned Block-Heel Festive Sandals (Draft Starter)', title_hi: 'वीमेन्स फेस्टिव ब्लॉक-हील सैंडल', sku_prefix: 'AG-STR-F05', product_type: 'Womens Sandals', price: 1499, sizes: ['UK 4', 'UK 5', 'UK 6', 'UK 7'], color: 'Champagne Gold', hex: '#D4AF37', image: '/assets/catalog/dept_footwear_collection_1794585864961.jpg', desc: 'Starter draft entry. Verify UK sizing and stock before publishing.' },
      { dept: 'footwear', subSlug: 'footwear-womens-footwear', title: 'Womens Embroidered Comfort Ethnic Jutti (Draft Starter)', title_hi: 'वीमेन्स एम्ब्रॉयडर्ड जूती', sku_prefix: 'AG-STR-F06', product_type: 'Womens Jutti', price: 999, sizes: ['UK 4', 'UK 5', 'UK 6', 'UK 7'], color: 'Rose Gold', hex: '#C0847D', image: '/assets/catalog/dept_footwear_collection_1794585864961.jpg', desc: 'Starter draft entry. Verify stock before publishing.' },
      { dept: 'footwear', subSlug: 'footwear-sandals', title: 'Adjustable Strappy Leather Comfort Sandals (Draft Starter)', title_hi: 'लेदर कम्फर्ट सैंडल', sku_prefix: 'AG-STR-F07', product_type: 'Sandals', price: 1399, sizes: ['UK 7', 'UK 8', 'UK 9'], color: 'Dark Brown', hex: '#5C3A21', image: '/assets/catalog/prod_formal_footwear_1794585865848.jpg', desc: 'Starter draft entry. Verify stock before publishing.' },
      { dept: 'footwear', subSlug: 'footwear-slippers', title: 'Orthopedic Cushioned Everyday Home Sliders (Draft Starter)', title_hi: 'कम्फर्ट स्लाइडर्स स्लीपर्स', sku_prefix: 'AG-STR-F08', product_type: 'Slippers', price: 599, sizes: ['UK 7', 'UK 8', 'UK 9', 'UK 10'], color: 'Slate Black', hex: '#1F2937', image: '/assets/catalog/dept_footwear_collection_1794585864961.jpg', desc: 'Starter draft entry. Verify stock before publishing.' },
      { dept: 'footwear', subSlug: 'footwear-kids-footwear', title: 'Kids Velcro Breathable Sports Sneakers (Draft Starter)', title_hi: 'किड्स वेल्क्रो स्पोर्ट्स शूज़', sku_prefix: 'AG-STR-F09', product_type: 'Kids Sneakers', price: 899, sizes: ['UK 1', 'UK 2', 'UK 3', 'UK 4'], color: 'Navy Red', hex: '#1D4ED8', image: '/assets/catalog/dept_footwear_collection_1794585864961.jpg', desc: 'Starter draft entry. Verify kids sizes and stock before publishing.' },
    ];

    for (const st of starterDraftTemplates) {
      const exists = db.prepare('SELECT id FROM products WHERE sku_prefix = ?').get(st.sku_prefix);
      if (exists) continue;
      const pId = uid();
      const catId = categoryMap.get(st.dept) || null;
      const subId = categoryMap.get(st.subSlug) || null;
      const slug = st.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + st.sku_prefix.toLowerCase();

      db.prepare(`
        INSERT INTO products (
          id, title, title_hi, slug, sku_prefix, description, fabric_care, department,
          category_id, subcategory_id, regular_price, discounted_price, product_type,
          tags_json, is_featured, is_best_seller, is_new_arrival, is_trending, is_published, review_status, popularity_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, 0, 1, 0, 0, 'draft_needs_review', 10)
      `).run(
        pId, st.title, st.title_hi, slug, st.sku_prefix, st.desc, 'Starter template — update fabric & care notes before publishing.',
        st.dept, catId, subId, st.price, st.product_type, JSON.stringify(['starter-draft', st.dept])
      );
      db.prepare('INSERT INTO product_images (id, product_id, image_url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, 0, 1)').run(
        uid(), pId, st.image, st.title
      );
      st.sizes.forEach((sz) => {
        const vId = uid();
        const sku = `${st.sku_prefix}-${sz.replace(/\s+/g, '')}-${st.color.slice(0, 3).toUpperCase()}`;
        db.prepare('INSERT INTO product_variants (id, product_id, sku, size, color, color_hex) VALUES (?, ?, ?, ?, ?, ?)').run(
          vId, pId, sku, sz, st.color, st.hex
        );
        db.prepare('INSERT INTO inventory (variant_id, quantity_available, quantity_reserved, low_stock_threshold) VALUES (?, 0, 0, 5)').run(vId);
      });
      const newArrCol = colMap.get('new-arrivals');
      if (newArrCol) {
        db.prepare('INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES (?, ?, 99)').run(newArrCol, pId);
      }
    }

    // 10. Homepage Sections & Banners (Insert only if empty)
    if ((db.prepare('SELECT COUNT(*) as c FROM homepage_sections').get() as { c: number }).c === 0) {
      const sections = [
        {
          key: 'hero',
          type: 'hero',
          title: 'Ultimate Fashion Destination for the Entire Family',
          subtitle: 'Curated Men’s, Women’s, Kids Wear & Footwear at Arora Garments, Bulandshahr. Local doorstep delivery across Bulandshahr, Sikandrabad, Shikarpur & Jahangirabad.',
          cta_label: 'Explore Collection',
          cta_link: '/products',
          image_url: '/assets/catalog/hero_arora_campaign_1794585862847.jpg',
          order: 1,
        },
        {
          key: 'departments',
          type: 'departments',
          title: 'Shop by Department',
          subtitle: 'Four complete fashion departments for everyday wear, office dressing, and festive celebrations.',
          cta_label: 'View All Categories',
          cta_link: '/products',
          image_url: '',
          order: 2,
        },
        {
          key: 'featured_grid',
          type: 'product_grid',
          title: 'Featured Arrivals & Bestsellers',
          subtitle: 'Selected garments and footwear ready for local dispatch or store pickup.',
          cta_label: 'Shop All Products',
          cta_link: '/products',
          image_url: '',
          order: 3,
        },
        {
          key: 'seasonal_campaign',
          type: 'campaign',
          title: 'Seasonal & Festive Edit 2026',
          subtitle: 'Handloom cotton kurtas, zari-bordered ethnic sets, and handcrafted footwear curated at our Faislabad showroom.',
          cta_label: 'Shop Seasonal Edit',
          cta_link: '/seasonal',
          image_url: '/assets/catalog/collection_seasonal_festive_1794594450366.jpg',
          order: 4,
        },
        {
          key: 'whatsapp_pan_india',
          type: 'whatsapp_enquiry',
          title: 'Pan-India Orders via WhatsApp',
          subtitle: 'Outside our Bulandshahr local zones? Request sizes, fabric photos, and courier availability directly with our store team.',
          cta_label: 'Enquire on WhatsApp',
          cta_link: '/how-to-order',
          image_url: '',
          order: 5,
        },
        {
          key: 'store_info',
          type: 'store_info',
          title: 'Visit Our Bulandshahr Showroom',
          subtitle: 'CV59+RH9, Faislabad, Bulandshahr, Uttar Pradesh 203001 · Open Daily 10:00 AM – 8:30 PM',
          cta_label: 'Get Store Directions',
          cta_link: '/store-location',
          image_url: '',
          order: 6,
        },
      ];

      const insSec = db.prepare(
        'INSERT INTO homepage_sections (id, section_key, section_type, title, subtitle, cta_label, cta_link, image_url, sort_order, is_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
      );
      sections.forEach((s) => insSec.run(uid(), s.key, s.type, s.title, s.subtitle, s.cta_label, s.cta_link, s.image_url, s.order));
    }

    // Upgrade seasonal_campaign image only if still pointing to old starter asset
    db.prepare(
      `UPDATE homepage_sections SET image_url = '/assets/catalog/collection_seasonal_festive_1794594450366.jpg' WHERE section_key = 'seasonal_campaign' AND image_url = '/assets/catalog/dept_womens_ethnic_1794585864304.jpg'`
    ).run();

    // Seed multi-slide Hero Slider once without ever restoring admin-deleted slides later
    const slidesSeeded = db.prepare(`SELECT value_json FROM website_settings WHERE key = 'hero_slides_seeded'`).get();
    if (!slidesSeeded) {
      db.prepare(`UPDATE banners SET cta_label = COALESCE(NULLIF(cta_label, ''), 'Explore Collection'), duration_seconds = COALESCE(duration_seconds, 8) WHERE placement = 'hero'`).run();

      const existingBannersCount = (db.prepare(`SELECT COUNT(*) as c FROM banners WHERE placement = 'hero'`).get() as { c: number }).c;
      const insBanner = db.prepare(
        'INSERT INTO banners (id, title, subtitle, cta_label, image_url, link_url, placement, sort_order, duration_seconds, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
      );
      if (existingBannersCount === 0) {
        insBanner.run(
          uid(),
          '2026 Family Fashion Edit',
          'Tailored Shirts, Festive Kurtas, Kids Wear & Handcrafted Footwear',
          'Explore Collection',
          '/assets/catalog/hero_arora_campaign_1794585862847.jpg',
          '/products',
          'hero',
          1,
          8
        );
      }
      insBanner.run(
        uid(),
        'Everyday Tailoring & Smart Casuals',
        'Crisp Oxford cotton shirts, breathable linens, and modern denim curated for Bulandshahr.',
        "Shop Men's & Women's",
        '/assets/catalog/hero_slide_everyday_1794594451317.jpg',
        '/new-arrivals',
        'hero',
        2,
        8
      );
      insBanner.run(
        uid(),
        'Festive & Wedding Showroom Edit',
        'Handloom ethnic ensembles, kids festive outfits, and leather footwear with same-day local dispatch.',
        'Explore Seasonal Edit',
        '/assets/catalog/collection_seasonal_festive_1794594450366.jpg',
        '/seasonal',
        'hero',
        3,
        10
      );
      db.prepare(`INSERT OR IGNORE INTO website_settings (key, value_json) VALUES ('hero_slides_seeded', '{"seeded":true}')`).run();
    }
  });

  tx();
}
