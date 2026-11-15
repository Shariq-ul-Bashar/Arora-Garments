-- ARORA GARMENTS — Row Level Security, Storage Buckets & Atomic Functions (002)

-- Helper function to check admin role from user_roles
CREATE OR REPLACE FUNCTION public.has_staff_role(target_roles TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = ANY(target_roles)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS across all sensitive tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serviceable_pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Public Read Policies for Storefront Catalog
CREATE POLICY "Public read published products" ON public.products
  FOR SELECT USING (is_published = TRUE AND is_archived = FALSE);

CREATE POLICY "Staff manage products" ON public.products
  FOR ALL USING (public.has_staff_role(ARRAY['owner', 'manager', 'content_staff']));

CREATE POLICY "Public read catalog taxonomy" ON public.categories FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Staff manage categories" ON public.categories FOR ALL USING (public.has_staff_role(ARRAY['owner', 'manager']));

CREATE POLICY "Public read product images" ON public.product_images FOR SELECT USING (TRUE);
CREATE POLICY "Staff manage product images" ON public.product_images FOR ALL USING (public.has_staff_role(ARRAY['owner', 'manager', 'content_staff']));

CREATE POLICY "Public read variants" ON public.product_variants FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Staff manage variants" ON public.product_variants FOR ALL USING (public.has_staff_role(ARRAY['owner', 'manager']));

CREATE POLICY "Public read inventory" ON public.inventory FOR SELECT USING (TRUE);
CREATE POLICY "Staff manage inventory" ON public.inventory FOR ALL USING (public.has_staff_role(ARRAY['owner', 'manager']));

CREATE POLICY "Public read cms" ON public.homepage_sections FOR SELECT USING (is_visible = TRUE);
CREATE POLICY "Staff manage cms" ON public.homepage_sections FOR ALL USING (public.has_staff_role(ARRAY['owner', 'content_staff']));

CREATE POLICY "Public read banners" ON public.banners FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Staff manage banners" ON public.banners FOR ALL USING (public.has_staff_role(ARRAY['owner', 'content_staff']));

CREATE POLICY "Public read settings" ON public.website_settings FOR SELECT USING (TRUE);
CREATE POLICY "Owner manage settings" ON public.website_settings FOR ALL USING (public.has_staff_role(ARRAY['owner']));

CREATE POLICY "Public read pincodes" ON public.serviceable_pincodes FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Staff manage pincodes" ON public.serviceable_pincodes FOR ALL USING (public.has_staff_role(ARRAY['owner', 'manager']));

-- Customer Isolation Policies
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Staff read profiles" ON public.profiles FOR SELECT USING (public.has_staff_role(ARRAY['owner', 'manager', 'order_staff']));

CREATE POLICY "Users manage own addresses" ON public.addresses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own wishlist" ON public.wishlists FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff manage orders" ON public.orders FOR ALL USING (public.has_staff_role(ARRAY['owner', 'manager', 'order_staff']));

CREATE POLICY "Users view own order items" ON public.order_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "Staff view order items" ON public.order_items
  FOR ALL USING (public.has_staff_role(ARRAY['owner', 'manager', 'order_staff']));

CREATE POLICY "Owner manage roles" ON public.user_roles FOR ALL USING (public.has_staff_role(ARRAY['owner']));
CREATE POLICY "Owner read audit logs" ON public.admin_activity_logs FOR SELECT USING (public.has_staff_role(ARRAY['owner', 'manager']));

-- Atomic Inventory Deduction Function (prevents overselling under concurrency)
CREATE OR REPLACE FUNCTION public.deduct_variant_stock(p_variant_id UUID, p_qty INTEGER, p_order_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_avail INTEGER;
BEGIN
  SELECT quantity_available INTO v_avail
  FROM public.inventory
  WHERE variant_id = p_variant_id
  FOR UPDATE;

  IF v_avail IS NULL OR v_avail < p_qty THEN
    RAISE EXCEPTION 'Insufficient stock for variant %', p_variant_id;
  END IF;

  UPDATE public.inventory
  SET quantity_available = quantity_available - p_qty,
      updated_at = NOW()
  WHERE variant_id = p_variant_id;

  INSERT INTO public.inventory_movements (variant_id, change_amount, reason, reference_id, note)
  VALUES (p_variant_id, -p_qty, 'order_placed', p_order_id, 'Atomic order stock deduction');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supabase Storage Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('product-images', 'product-images', TRUE),
  ('category-images', 'category-images', TRUE),
  ('banners', 'banners', TRUE),
  ('brand-assets', 'brand-assets', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read storage assets" ON storage.objects
  FOR SELECT USING (bucket_id IN ('product-images', 'category-images', 'banners', 'brand-assets'));

CREATE POLICY "Staff upload storage assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('product-images', 'category-images', 'banners', 'brand-assets')
    AND public.has_staff_role(ARRAY['owner', 'manager', 'content_staff'])
  );
