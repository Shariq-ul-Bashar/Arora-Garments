export type DepartmentSlug = 'mens-wear' | 'womens-wear' | 'kids-wear' | 'footwear';

export interface AuthUser {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  preferred_language: 'en' | 'hi';
  roles: string[];
  permissions: string[];
}

export interface BusinessInfo {
  brand_name: string;
  tagline: string;
  business_type: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  primary_phone: string;
  secondary_phone: string;
  whatsapp_primary: string;
  whatsapp_secondary: string;
  instagram_1: string;
  instagram_2: string;
  operating_hours: string;
  currency: string;
  currency_symbol: string;
  timezone: string;
  announcement_text: string;
  announcement_enabled: boolean;
  maps_directions_url: string;
}

export interface GstRateBucket {
  rate: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
}

export interface GstBreakdown {
  gst_enabled: boolean;
  tax_calculation_mode: 'inclusive' | 'exclusive';
  supply_type: 'intra_state' | 'inter_state';
  seller_state: string;
  customer_state: string;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  tax_amount: number;
  grand_total: number;
  rate_breakdown: GstRateBucket[];
}

export interface InvoiceSettings {
  gst_enabled?: boolean;
  gstin: string;
  legal_name?: string;
  seller_state?: string;
  default_gst_rate?: number;
  tax_rate_percent: number;
  tax_calculation_mode?: 'inclusive' | 'exclusive';
  tax_label: string;
  return_window_days: number;
  footer_note: string;
}

export interface HeroBanner {
  id: string;
  title: string;
  subtitle?: string;
  cta_label?: string;
  image_url: string;
  link_url?: string;
  placement: string;
  sort_order?: number;
  duration_seconds?: number;
  is_active?: number;
}

export interface BrandingSettings {
  main_logo_url: string;
  light_logo_url: string;
  dark_logo_url: string;
  favicon_url: string;
  logo_width: number;
  logo_height: number;
  logo_alignment: 'left' | 'center';
}

export interface AppearanceSettings {
  active_theme_id:
    | 'modern-classic'
    | 'premium-luxury'
    | 'urban-streetwear'
    | 'festive-ethnic'
    | 'family-fashion'
    | 'editorial-minimal';
  custom_overrides?: {
    primary_color?: string;
    secondary_color?: string;
    background_color?: string;
    surface_color?: string;
    text_color?: string;
    accent_color?: string;
    heading_font?: string;
    body_font?: string;
    button_style?: '' | 'sharp' | 'soft' | 'rounded';
    card_style?: '' | 'bordered' | 'elevated' | 'flat' | 'minimal';
    border_radius?: '' | 'sharp' | 'soft' | 'rounded';
    animation_intensity?: 'subtle' | 'moderate' | 'minimal';
  };
}

export interface PaymentSettings {
  cod_enabled: boolean;
  upi_whatsapp_enabled: boolean;
  upi_id: string;
  upi_payee_name: string;
  upi_qr_url: string;
  upi_instructions: string;
}

export interface DeliveryZone {
  pincode: string;
  area_name: string;
  town_name?: string | null;
  city: string;
  state: string;
  radius_km?: number | null;
  min_order_value?: number | null;
  delivery_fee: number;
  free_delivery_above: number | null;
  cod_allowed: number;
  estimated_days: string;
  notes?: string | null;
  is_active: number;
}

export interface Category {
  id: string;
  name: string;
  name_hi?: string | null;
  slug: string;
  department: DepartmentSlug;
  parent_id: string | null;
  description?: string | null;
  image_url?: string | null;
  sort_order: number;
  is_active: number;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description?: string;
  banner_image_url?: string;
  is_active: number;
  sort_order: number;
  product_ids?: string[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
  is_primary: number;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  size: string;
  color: string;
  color_hex: string;
  price_override: number | null;
  is_active: number;
  quantity_available: number;
  low_stock_threshold: number;
}

export interface Product {
  id: string;
  title: string;
  title_hi?: string | null;
  slug: string;
  sku_prefix: string;
  description: string;
  fabric_care?: string | null;
  department: DepartmentSlug;
  category_id: string | null;
  subcategory_id: string | null;
  category_name?: string;
  subcategory_name?: string;
  subcategory_slug?: string;
  regular_price: number;
  discounted_price: number | null;
  gst_rate?: number | null;
  effective_price: number;
  discount_percentage: number;
  product_type: string;
  tags: string[];
  is_featured: number;
  is_best_seller: number;
  is_new_arrival: number;
  is_trending: number;
  is_published: number;
  is_archived: number;
  review_status?: 'approved' | 'draft_needs_review' | string;
  images: ProductImage[];
  variants: ProductVariant[];
  total_stock: number;
}

export interface CartItem {
  cart_item_id: string;
  variant_id: string;
  product_id: string;
  title: string;
  slug: string;
  sku: string;
  size: string;
  color: string;
  color_hex: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  quantity_available: number;
  image_url?: string | null;
}

export interface BuyNowSelection {
  variant_id: string;
  product_id: string;
  title: string;
  slug: string;
  sku: string;
  size: string;
  color: string;
  color_hex: string;
  quantity: number;
  unit_price: number;
  quantity_available: number;
  image_url?: string | null;
}

export interface HomepageSection {
  id: string;
  section_key: string;
  section_type: string;
  title: string;
  subtitle?: string;
  cta_label?: string;
  cta_link?: string;
  image_url?: string;
  sort_order: number;
  is_visible: number;
}

export interface OrderRecord {
  id: string;
  order_number: string;
  invoice_number: string;
  customer_name: string;
  customer_mobile: string;
  customer_email?: string | null;
  shipping_address: {
    address_line: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
  };
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  tax_amount: number;
  gst_breakdown?: GstBreakdown | null;
  grand_total: number;
  coupon_code?: string | null;
  payment_method: string;
  payment_status: string;
  payment_reference?: string | null;
  payment_claim_note?: string | null;
  payment_verified_by?: string | null;
  payment_verified_at?: string | null;
  is_proforma?: number;
  order_source: string;
  order_status: string;
  courier_partner?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipped_at?: string | null;
  expected_delivery_date?: string | null;
  created_at: string;
  items?: Array<{
    id: string;
    product_title: string;
    sku: string;
    size: string;
    color: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  history?: Array<{
    status: string;
    note?: string;
    changed_by_name?: string;
    created_at: string;
  }>;
}

export interface ProductReview {
  id: string;
  user_id?: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  is_verified_purchase: number;
  admin_reply?: string | null;
  created_at: string;
}

export interface AdminReviewRecord extends ProductReview {
  product_id: string;
  product_title: string;
  product_slug: string;
  sku_prefix?: string;
  product_image?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  is_approved: number;
}

