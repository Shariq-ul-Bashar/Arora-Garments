import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, Heart, MessageCircle, Ruler, ShieldCheck, ShoppingBag, Star, Truck, Zap, ZoomIn } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch, DEPARTMENT_LABELS, formatINR } from '../lib/api';
import type { Product, ProductReview, ProductVariant } from '../types';
import { SmartImage } from '../components/Fallbacks';
import { ProductCard } from '../components/ProductCard';
import { CustomerReviews } from '../components/CustomerReviews';

export function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const {
    addToCart,
    setBuyNowItem,
    toggleWishlist,
    wishlistIds,
    recentlyViewed,
    addRecentlyViewed,
    bootstrap,
    user,
    notify,
  } = useStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    apiFetch<{ product: Product; reviews: ProductReview[]; related: Product[] }>(`/api/products/${slug}`)
      .then((res) => {
        setProduct(res.product);
        setReviews(res.reviews);
        setRelated(res.related);
        setActiveImage(res.product.images?.[0]?.image_url || null);
        const firstInStock = res.product.variants.find((v) => v.quantity_available > 0) || res.product.variants[0];
        if (firstInStock) {
          setSelectedColor(firstInStock.color);
          setSelectedSize(firstInStock.size);
        }
        addRecentlyViewed(res.product);
        apiFetch('/api/analytics/event', {
          method: 'POST',
          body: JSON.stringify({ event_type: 'product_view', product_id: res.product.id }),
        }).catch(() => {});
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [slug, addRecentlyViewed]);

  const colors = useMemo(() => {
    if (!product) return [];
    const map = new Map<string, string>();
    product.variants.forEach((v) => map.set(v.color, v.color_hex));
    return Array.from(map.entries()).map(([color, hex]) => ({ color, hex }));
  }, [product]);

  const sizesForColor = useMemo(() => {
    if (!product) return [];
    return product.variants.filter((v) => !selectedColor || v.color === selectedColor);
  }, [product, selectedColor]);

  const activeVariant: ProductVariant | undefined = useMemo(() => {
    if (!product) return undefined;
    return product.variants.find((v) => v.color === selectedColor && v.size === selectedSize);
  }, [product, selectedColor, selectedSize]);

  const availableQty = activeVariant?.quantity_available ?? 0;
  const unitPrice = activeVariant?.price_override ?? product?.effective_price ?? 0;

  const handleAdd = async () => {
    if (!activeVariant || availableQty < 1) {
      notify('Please select an available size and colour', 'error');
      return;
    }
    setAdding(true);
    try {
      await addToCart(activeVariant.id, quantity);
    } catch (err: any) {
      notify(err.message || 'Could not add item', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = () => {
    if (!product || !activeVariant || availableQty < quantity) {
      notify('Please select an in-stock size and colour first', 'error');
      return;
    }
    setBuyNowItem({
      variant_id: activeVariant.id,
      product_id: product.id,
      title: product.title,
      slug: product.slug,
      sku: activeVariant.sku,
      size: activeVariant.size,
      color: activeVariant.color,
      color_hex: activeVariant.color_hex,
      quantity,
      unit_price: unitPrice,
      quantity_available: availableQty,
      image_url: activeImage || product.images?.[0]?.image_url || null,
    });
    navigate('/checkout?mode=buy-now');
  };

  const reloadReviews = async () => {
    if (!product) return;
    const fresh = await apiFetch<{ reviews: ProductReview[] }>(`/api/products/${product.slug}`);
    setReviews(fresh.reviews);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-sm" style={{ color: 'var(--ag-muted)' }}>
        Loading garment details...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="ag-heading text-3xl font-semibold">Product Not Found</h1>
        <Link to="/products" className="mt-5 inline-block px-6 py-3 text-sm ag-btn-primary">
          Return to Catalog
        </Link>
      </div>
    );
  }

  const biz = bootstrap?.business_info;
  const waNumber = (biz?.whatsapp_primary || '919897694349').replace(/\D/g, '');
  const inWishlist = wishlistIds.has(product.id);
  const waProductMsg = `Hello Arora Garments, I am interested in "${product.title}" (SKU: ${activeVariant?.sku || product.sku_prefix}, Size: ${selectedSize}, Colour: ${selectedColor}). Is it available?`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 lg:pb-14">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs flex items-center gap-2 mb-6" style={{ color: 'var(--ag-muted)' }}>
        <Link to="/" className="hover:opacity-75">Home</Link>
        <span>/</span>
        <Link to={`/${product.department}`} className="hover:opacity-75">
          {DEPARTMENT_LABELS[product.department] || product.department}
        </Link>
        {product.subcategory_name && (
          <>
            <span>/</span>
            <Link to={`/category/${product.subcategory_slug}`} className="hover:opacity-75">
              {product.subcategory_name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="truncate" style={{ color: 'var(--ag-ink)' }}>{product.title}</span>
      </nav>

      {/* Main Split: Gallery Left + Purchase Module Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div
            onClick={() => setZoomed((z) => !z)}
            className="relative ag-store-card overflow-hidden cursor-zoom-in"
            style={{ backgroundColor: 'var(--ag-surface)' }}
          >
            <img
              src={activeImage || product.images?.[0]?.image_url}
              alt={product.title}
              className={`w-full aspect-[3/4] object-cover transition-transform duration-300 ${
                zoomed ? 'scale-150 cursor-zoom-out' : 'scale-100'
              }`}
            />
            <span className="absolute bottom-3 right-3 bg-white/95 border px-2.5 py-1 text-[11px] flex items-center gap-1 text-[#111827]" style={{ borderColor: 'var(--ag-border)' }}>
              <ZoomIn className="w-3.5 h-3.5" />
              {zoomed ? 'Reset Zoom' : 'Click to Zoom'}
            </span>
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-5 gap-3">
              {product.images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => {
                    setActiveImage(img.image_url);
                    setZoomed(false);
                  }}
                  className="border overflow-hidden cursor-pointer"
                  style={{
                    borderColor: activeImage === img.image_url ? 'var(--ag-ink)' : 'var(--ag-border)',
                    borderRadius: 'var(--ag-radius)',
                  }}
                >
                  <SmartImage src={img.image_url} alt={img.alt_text || product.title} aspectClass="aspect-[3/4]" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Purchase Module */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.1em]" style={{ color: 'var(--ag-muted)' }}>
              {DEPARTMENT_LABELS[product.department]} · SKU: <span className="font-mono">{activeVariant?.sku || product.sku_prefix}</span>
            </p>
            <h1 className="mt-2 ag-heading text-2xl sm:text-3xl leading-tight">
              {product.title}
            </h1>
            {reviews.length > 0 && (
              <a
                href="#customer-reviews"
                className="mt-2 inline-flex items-center gap-1.5 text-xs hover:underline"
                style={{ color: 'var(--ag-muted)' }}
              >
                <Star className="w-3.5 h-3.5" style={{ fill: 'var(--ag-accent)', color: 'var(--ag-accent)' }} />
                <span className="font-semibold" style={{ color: 'var(--ag-ink)' }}>
                  {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                </span>
                <span>({reviews.length} customer {reviews.length === 1 ? 'review' : 'reviews'})</span>
              </a>
            )}

            <div className="mt-3.5 flex items-baseline gap-3 tabular-nums">
              <span className="text-2xl font-bold">{formatINR(unitPrice)}</span>
              {product.discount_percentage > 0 && (
                <>
                  <span className="text-base line-through" style={{ color: 'var(--ag-muted)' }}>
                    {formatINR(product.regular_price)}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--ag-accent)' }}>
                    Save {product.discount_percentage}%
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--ag-muted)' }}>Inclusive of applicable taxes</p>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
            {product.description}
          </p>

          {/* Colour Selector */}
          {colors.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2">
                Colour: <span className="font-normal" style={{ color: 'var(--ag-muted)' }}>{selectedColor}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => {
                  const hasStock = product.variants.some((v) => v.color === c.color && v.quantity_available > 0);
                  const active = selectedColor === c.color;
                  return (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => {
                        setSelectedColor(c.color);
                        const match =
                          product.variants.find((v) => v.color === c.color && v.quantity_available > 0) ||
                          product.variants.find((v) => v.color === c.color);
                        if (match) setSelectedSize(match.size);
                        setQuantity(1);
                      }}
                      className={`px-3 py-2 border text-xs flex items-center gap-2 cursor-pointer ${!hasStock ? 'opacity-50' : ''}`}
                      style={{
                        borderColor: active ? 'var(--ag-ink)' : 'var(--ag-border)',
                        backgroundColor: active ? 'var(--ag-card)' : 'var(--ag-surface)',
                        fontWeight: active ? 600 : 400,
                        borderRadius: 'var(--ag-btn-radius)',
                      }}
                    >
                      <span className="w-3.5 h-3.5 border border-black/20" style={{ backgroundColor: c.hex }} />
                      <span>{c.color}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider">
                Size: <span className="font-normal" style={{ color: 'var(--ag-muted)' }}>{selectedSize}</span>
              </p>
              <button
                type="button"
                onClick={() => setSizeGuideOpen(true)}
                className="inline-flex items-center gap-1 text-xs underline underline-offset-4 cursor-pointer"
                style={{ color: 'var(--ag-muted)' }}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>Size Guide</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {sizesForColor.map((v) => {
                const disabled = v.quantity_available <= 0;
                const active = selectedSize === v.size;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      setSelectedSize(v.size);
                      setQuantity(1);
                    }}
                    className={`min-w-[3.25rem] px-3.5 py-2.5 border text-xs font-medium transition-colors ${
                      disabled ? 'line-through cursor-not-allowed opacity-45' : 'cursor-pointer'
                    }`}
                    style={
                      disabled
                        ? { borderColor: 'var(--ag-border)', backgroundColor: 'var(--ag-surface)' }
                        : active
                          ? { borderColor: 'var(--ag-btn-bg)', backgroundColor: 'var(--ag-btn-bg)', color: 'var(--ag-btn-text)', borderRadius: 'var(--ag-btn-radius)' }
                          : { borderColor: 'var(--ag-border)', backgroundColor: 'var(--ag-card)', borderRadius: 'var(--ag-btn-radius)' }
                    }
                  >
                    {v.size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Availability & Quantity */}
          <div className="flex items-center justify-between py-3 border-y text-xs" style={{ borderColor: 'var(--ag-border)' }}>
            <span className={availableQty > 0 ? 'text-[#15803D] font-semibold' : 'text-[#991B1B] font-semibold'}>
              {availableQty > 0
                ? availableQty <= 5
                  ? `Only ${availableQty} left in stock`
                  : `In Stock (${availableQty} available)`
                : 'Currently Out of Stock'}
            </span>
            <div className="flex items-center border bg-white text-[#111827]" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-1.5 text-sm cursor-pointer"
              >
                −
              </button>
              <span className="px-3 py-1.5 tabular-nums font-semibold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(Math.max(1, availableQty), q + 1))}
                className="px-3 py-1.5 text-sm cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Mandatory Actions: Add to Cart + Buy Now + Wishlist + WhatsApp */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={availableQty <= 0 || adding}
                onClick={handleAdd}
                className="py-3.5 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-45 cursor-pointer ag-btn-primary"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{availableQty <= 0 ? 'Out of Stock' : adding ? 'Adding...' : 'Add to Cart'}</span>
              </button>

              <button
                type="button"
                disabled={availableQty <= 0}
                onClick={handleBuyNow}
                className="py-3.5 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-45 cursor-pointer border"
                style={{
                  backgroundColor: 'var(--ag-accent)',
                  color: '#FFFFFF',
                  borderColor: 'var(--ag-accent)',
                  borderRadius: 'var(--ag-btn-radius)',
                }}
              >
                <Zap className="w-4 h-4" />
                <span>Buy Now</span>
              </button>
            </div>

            <div className="flex gap-2.5">
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waProductMsg)}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 px-4 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-opacity ag-btn-secondary"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enquire / Pan-India Order on WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label="Toggle wishlist"
                className="w-12 border bg-white text-[#111827] flex items-center justify-center cursor-pointer"
                style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
              >
                <Heart className={`w-5 h-5 ${inWishlist ? 'fill-current' : ''}`} style={inWishlist ? { color: 'var(--ag-accent)' } : undefined} />
              </button>
            </div>
          </div>

          {/* Product & Policy Info */}
          <div className="pt-4 space-y-3 text-xs border-t" style={{ borderColor: 'var(--ag-border)', color: 'var(--ag-muted)' }}>
            {product.fabric_care && (
              <div className="flex items-start gap-2.5">
                <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ag-ink)' }} />
                <span><strong style={{ color: 'var(--ag-ink)' }}>Fabric &amp; Care:</strong> {product.fabric_care}</span>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <Truck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ag-ink)' }} />
              <span>
                <strong style={{ color: 'var(--ag-ink)' }}>Local Delivery:</strong> Bulandshahr, Sikandrabad, Shikarpur, Jahangirabad, Khurja &amp; nearby PINs. COD &amp; UPI via WhatsApp supported.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--ag-ink)' }} />
              <span>
                <strong style={{ color: 'var(--ag-ink)' }}>Returns:</strong> {bootstrap?.invoice_settings?.return_window_days || 7}-day exchange &amp; return policy on unworn garments with tags.{' '}
                <Link to="/return-policy" className="underline">Read Policy</Link>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews Component */}
      <CustomerReviews
        productId={product.id}
        productTitle={product.title}
        reviews={reviews}
        onReviewSubmitted={reloadReviews}
      />

      {/* Related Products */}
      {related.length > 0 && (
        <section className="mt-14 pt-10 border-t" style={{ borderColor: 'var(--ag-border)' }}>
          <h2 className="ag-heading text-2xl font-semibold mb-6">Related Pieces</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Viewed */}
      {recentlyViewed.filter((p) => p.id !== product.id).length > 0 && (
        <section className="mt-14 pt-10 border-t" style={{ borderColor: 'var(--ag-border)' }}>
          <h2 className="ag-heading text-2xl font-semibold mb-6">Recently Viewed</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {recentlyViewed
              .filter((p) => p.id !== product.id)
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </section>
      )}

      {/* Mobile Sticky Bar (Compact <= 64px, Add to Cart + Buy Now) */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t px-3 py-2 flex items-center justify-between gap-2 shadow-lg"
        style={{ backgroundColor: 'var(--ag-canvas)', borderColor: 'var(--ag-border)' }}
      >
        <div className="min-w-0 pr-1">
          <p className="text-[11px] truncate" style={{ color: 'var(--ag-muted)' }}>{product.title}</p>
          <p className="text-sm font-bold tabular-nums">{formatINR(unitPrice)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={availableQty <= 0 || adding}
            onClick={handleAdd}
            className="px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap disabled:opacity-45 cursor-pointer ag-btn-primary"
          >
            {availableQty <= 0 ? 'Sold Out' : 'Add to Cart'}
          </button>
          <button
            type="button"
            disabled={availableQty <= 0}
            onClick={handleBuyNow}
            className="px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap disabled:opacity-45 cursor-pointer text-white"
            style={{ backgroundColor: 'var(--ag-accent)', borderRadius: 'var(--ag-btn-radius)' }}
          >
            Buy Now
          </button>
        </div>
      </div>

      {/* Size Guide Modal */}
      {sizeGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white text-[#111827] border max-w-lg w-full p-6" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-radius)' }}>
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--ag-border)' }}>
              <h3 className="ag-heading text-lg font-semibold">Size Guide (Inches)</h3>
              <button type="button" onClick={() => setSizeGuideOpen(false)} className="text-sm underline cursor-pointer">
                Close
              </button>
            </div>
            <table className="w-full mt-4 text-xs text-left tabular-nums">
              <thead>
                <tr className="border-b text-[#525866]" style={{ borderColor: 'var(--ag-border)' }}>
                  <th className="py-2">Size</th>
                  <th className="py-2">Chest / Bust</th>
                  <th className="py-2">Waist</th>
                  <th className="py-2">Shoulder</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--ag-border)' }}>
                <tr><td className="py-2 font-medium">S</td><td>36 – 38</td><td>30 – 32</td><td>17.0</td></tr>
                <tr><td className="py-2 font-medium">M</td><td>38 – 40</td><td>32 – 34</td><td>17.8</td></tr>
                <tr><td className="py-2 font-medium">L</td><td>40 – 42</td><td>34 – 36</td><td>18.5</td></tr>
                <tr><td className="py-2 font-medium">XL</td><td>42 – 44</td><td>36 – 38</td><td>19.2</td></tr>
              </tbody>
            </table>
            <p className="mt-4 text-xs text-[#525866]">
              Need exact garment measurements or footwear UK/CM sizing? Message our store team on WhatsApp {biz?.primary_phone || '+91 9897694349'}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
