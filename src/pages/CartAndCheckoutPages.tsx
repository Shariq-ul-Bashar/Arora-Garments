import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Copy,
  FileDown,
  MapPin,
  MessageCircle,
  QrCode,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  apiFetch,
  downloadInvoicePdf,
  formatINR,
  paymentMethodLabel,
  paymentStatusBadgeClass,
  paymentStatusLabel,
} from '../lib/api';
import type { GstBreakdown, OrderRecord, PaymentSettings } from '../types';
import { SmartImage } from '../components/Fallbacks';

export function CartPage() {
  const { cart, bootstrap, updateCartQty, removeFromCart, notify } = useStore();
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [pinInput, setPinInput] = useState('203001');
  const [pinStatus, setPinStatus] = useState<{ serviceable: boolean; message?: string; details?: any } | null>(null);

  const zones = bootstrap?.serviceable_zones || [];

  const checkPin = async (overridePin?: string) => {
    const pin = (overridePin ?? pinInput).trim();
    if (!/^\d{6}$/.test(pin)) {
      notify('Enter a valid 6-digit PIN code', 'error');
      return;
    }
    const res = await apiFetch<any>(`/api/pincodes/check/${pin}`);
    setPinStatus(res);
  };

  const applyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ valid: boolean; code: string; discount: number }>('/api/cart/apply-coupon', {
        method: 'POST',
        body: JSON.stringify({ code: couponInput }),
      });
      setAppliedCoupon({ code: res.code, discount: res.discount });
      notify(`Coupon ${res.code} applied`);
    } catch (err: any) {
      notify(err.message || 'Invalid coupon', 'error');
    }
  };

  const estimatedDiscount = appliedCoupon?.discount || 0;
  const estTotal = Math.max(0, cart.subtotal - estimatedDiscount);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="ag-heading text-2xl sm:text-3xl font-semibold pb-5 border-b" style={{ borderColor: 'var(--ag-border)' }}>
        Shopping Bag ({cart.item_count})
      </h1>

      {cart.items.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-base" style={{ color: 'var(--ag-muted)' }}>Your shopping bag is currently empty.</p>
          <Link to="/products" className="mt-5 inline-block px-7 py-3 text-sm font-medium ag-btn-primary">
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 divide-y border-y" style={{ borderColor: 'var(--ag-border)' }}>
            {cart.items.map((item) => (
              <div key={item.variant_id} className="py-5 flex gap-4 sm:gap-6">
                <Link to={`/product/${item.slug}`} className="w-24 sm:w-28 shrink-0 border overflow-hidden" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-radius)' }}>
                  <SmartImage src={item.image_url} alt={item.title} aspectClass="aspect-[3/4]" />
                </Link>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="flex justify-between gap-4">
                    <div>
                      <Link to={`/product/${item.slug}`} className="font-semibold text-base hover:opacity-75">
                        {item.title}
                      </Link>
                      <p className="mt-1 text-xs" style={{ color: 'var(--ag-muted)' }}>
                        Size: {item.size} · Colour: {item.color} · SKU: <span className="font-mono">{item.sku}</span>
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums text-sm">{formatINR(item.line_total)}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center border bg-white text-[#111827]" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.variant_id, item.quantity - 1)}
                        className="px-3 py-1 text-sm cursor-pointer"
                      >
                        −
                      </button>
                      <span className="px-3 py-1 text-xs font-semibold tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.variant_id, item.quantity + 1)}
                        className="px-3 py-1 text-sm cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.variant_id)}
                      className="inline-flex items-center gap-1 text-xs text-[#991B1B] hover:opacity-75 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="ag-store-card p-6 space-y-4">
              <h2 className="ag-heading text-xl font-semibold">Order Summary</h2>
              <div className="space-y-2 text-sm tabular-nums">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ag-muted)' }}>Subtotal</span>
                  <span>{formatINR(cart.subtotal)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-[#15803D]">
                    <span>Coupon ({appliedCoupon.code})</span>
                    <span>− {formatINR(appliedCoupon.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs" style={{ color: 'var(--ag-muted)' }}>
                  <span>Delivery Charges</span>
                  <span>Calculated by PIN at Checkout</span>
                </div>
                <div className="pt-3 border-t flex justify-between font-bold text-base" style={{ borderColor: 'var(--ag-border)' }}>
                  <span>Estimated Total</span>
                  <span>{formatINR(estTotal)}</span>
                </div>
              </div>

              <form onSubmit={applyCoupon} className="pt-2 flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Coupon code"
                  className="flex-1 border bg-white text-[#111827] px-3 py-2 text-xs focus:outline-none"
                  style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
                />
                <button type="submit" className="px-4 py-2 text-xs font-medium cursor-pointer ag-btn-secondary">
                  Apply
                </button>
              </form>

              <Link
                to={`/checkout${appliedCoupon ? `?coupon=${encodeURIComponent(appliedCoupon.code)}` : ''}`}
                className="block w-full py-3.5 text-center text-sm font-semibold hover:opacity-90 transition-opacity ag-btn-primary"
              >
                Proceed to Checkout
              </Link>

              {/* Serviceability Estimator */}
              <div className="pt-4 border-t" style={{ borderColor: 'var(--ag-border)' }}>
                <p className="text-xs font-semibold mb-2">Check Local Delivery Zone (Bulandshahr &amp; Nearby)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="flex-1 border bg-white text-[#111827] px-3 py-1.5 text-xs tabular-nums"
                    style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
                  />
                  <button type="button" onClick={() => checkPin()} className="px-3 py-1.5 text-xs font-medium cursor-pointer ag-btn-secondary">
                    Check
                  </button>
                </div>
                {zones.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {zones.slice(0, 6).map((z) => (
                      <button
                        key={z.pincode}
                        type="button"
                        onClick={() => {
                          setPinInput(z.pincode);
                          checkPin(z.pincode);
                        }}
                        className="px-2 py-1 text-[11px] border bg-white text-[#111827] hover:border-[#111827] cursor-pointer"
                        style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
                      >
                        {z.town_name || z.area_name} ({z.pincode})
                      </button>
                    ))}
                  </div>
                )}
                {pinStatus && (
                  <p className={`mt-2 text-xs ${pinStatus.serviceable ? 'text-[#15803D]' : 'text-[#9A6B2F]'}`}>
                    {pinStatus.serviceable
                      ? `Available (${pinStatus.details.town_name || pinStatus.details.area_name}): ₹${pinStatus.details.delivery_fee} · ${pinStatus.details.estimated_days}${pinStatus.details.min_order_value > 0 ? ` · Min ₹${pinStatus.details.min_order_value}` : ''}`
                      : pinStatus.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface PlacedOrderModalData {
  order: {
    id: string;
    order_number: string;
    invoice_number: string;
    grand_total: number;
    payment_method: string;
    payment_status: string;
    is_proforma: number;
    customer_mobile: string;
  };
  whatsapp_url: string;
  payment_settings: PaymentSettings;
}

export function CheckoutPage() {
  const { cart, buyNowItem, setBuyNowItem, user, bootstrap, refreshCart, notify } = useStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isBuyNowMode = searchParams.get('mode') === 'buy-now' && Boolean(buyNowItem);
  const [buyNowQty, setBuyNowQty] = useState(() => buyNowItem?.quantity || 1);

  const checkoutItems = isBuyNowMode && buyNowItem
    ? [
        {
          variant_id: buyNowItem.variant_id,
          product_id: buyNowItem.product_id,
          title: buyNowItem.title,
          slug: buyNowItem.slug,
          sku: buyNowItem.sku,
          size: buyNowItem.size,
          color: buyNowItem.color,
          color_hex: buyNowItem.color_hex,
          quantity: buyNowQty,
          unit_price: buyNowItem.unit_price,
          line_total: buyNowItem.unit_price * buyNowQty,
          quantity_available: buyNowItem.quantity_available,
          image_url: buyNowItem.image_url,
        },
      ]
    : cart.items;

  const itemsSubtotal = checkoutItems.reduce((sum, it) => sum + it.line_total, 0);

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(user?.full_name || '');
  const [mobile, setMobile] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [addressLine, setAddressLine] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('Bulandshahr');
  const [stateName, setStateName] = useState('Uttar Pradesh');
  const [pincode, setPincode] = useState('203001');
  const [instructions, setInstructions] = useState('');
  const [shippingMethodId, setShippingMethodId] = useState('');
  const [couponCode, setCouponCode] = useState(() => searchParams.get('coupon') || '');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'UPI_WHATSAPP'>('COD');

  const [pinResult, setPinResult] = useState<{ serviceable: boolean; details?: any; message?: string } | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Post-order modal state
  const [placedModal, setPlacedModal] = useState<PlacedOrderModalData | null>(null);
  const [utrInput, setUtrInput] = useState('');
  const [claimingUtr, setClaimingUtr] = useState(false);
  const [claimSent, setClaimSent] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [previewPricing, setPreviewPricing] = useState<{
    subtotal: number;
    discount_amount: number;
    shipping_fee: number;
    taxable_amount: number;
    cgst_amount: number;
    sgst_amount: number;
    igst_amount: number;
    tax_amount: number;
    grand_total: number;
    coupon_error: string | null;
    gst: GstBreakdown;
  } | null>(null);

  const zones = bootstrap?.serviceable_zones || [];
  const paySettings = bootstrap?.payment_settings;
  const codEnabled = paySettings?.cod_enabled !== false;
  const upiEnabled = paySettings?.upi_whatsapp_enabled !== false;

  useEffect(() => {
    if (!codEnabled && upiEnabled) setPaymentMethod('UPI_WHATSAPP');
  }, [codEnabled, upiEnabled]);

  useEffect(() => {
    apiFetch('/api/analytics/event', {
      method: 'POST',
      body: JSON.stringify({ event_type: 'checkout_initiated' }),
    }).catch(() => {});

    if (user) {
      apiFetch<{ addresses: any[] }>('/api/addresses')
        .then((res) => {
          setSavedAddresses(res.addresses);
          const def = res.addresses.find((a) => a.is_default) || res.addresses[0];
          if (def) {
            setName(def.full_name);
            setMobile(def.mobile);
            setAddressLine(def.address_line);
            setLocality(def.locality);
            setCity(def.city);
            setStateName(def.state);
            setPincode(def.pincode);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (/^\d{6}$/.test(pincode)) {
      apiFetch<any>(`/api/pincodes/check/${pincode}`).then(setPinResult).catch(() => {});
    } else {
      setPinResult(null);
    }
  }, [pincode]);

  useEffect(() => {
    if (checkoutItems.length === 0) return;
    const t = window.setTimeout(() => {
      apiFetch<any>('/api/checkout/preview', {
        method: 'POST',
        body: JSON.stringify({
          mode: isBuyNowMode ? 'buy_now' : 'cart',
          buy_now_item: isBuyNowMode && buyNowItem ? { variant_id: buyNowItem.variant_id, quantity: buyNowQty } : undefined,
          pincode,
          shipping_method_id: shippingMethodId || undefined,
          coupon_code: couponCode || undefined,
          state: stateName,
        }),
      })
        .then(setPreviewPricing)
        .catch(() => {});
    }, 150);
    return () => window.clearTimeout(t);
  }, [checkoutItems.length, itemsSubtotal, isBuyNowMode, buyNowItem, buyNowQty, pincode, shippingMethodId, couponCode, stateName]);

  const selectedMethod = bootstrap?.shipping_methods?.find((m) => m.id === shippingMethodId);
  const baseShippingFee =
    previewPricing?.shipping_fee ??
    (selectedMethod?.base_fee === 0
      ? 0
      : pinResult?.serviceable
        ? pinResult.details.free_delivery_above && itemsSubtotal >= pinResult.details.free_delivery_above
          ? 0
          : Number(pinResult.details.delivery_fee || 0)
        : 0);

  const minOrderGap =
    pinResult?.serviceable && pinResult.details?.min_order_value > 0 && itemsSubtotal < pinResult.details.min_order_value
      ? pinResult.details.min_order_value - itemsSubtotal
      : 0;

  const estDiscount = previewPricing?.discount_amount || 0;
  const estTax = previewPricing?.tax_amount || 0;
  const estGrandTotal = previewPricing?.grand_total ?? itemsSubtotal + baseShippingFee + estTax;

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutItems.length === 0) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<PlacedOrderModalData>('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          mode: isBuyNowMode ? 'buy_now' : 'cart',
          buy_now_item:
            isBuyNowMode && buyNowItem
              ? { variant_id: buyNowItem.variant_id, quantity: buyNowQty }
              : undefined,
          customer_name: name,
          customer_mobile: mobile,
          customer_email: email,
          address_line: addressLine,
          locality,
          city,
          state: stateName,
          pincode,
          delivery_instructions: instructions,
          shipping_method_id: shippingMethodId || undefined,
          coupon_code: couponCode || undefined,
          payment_method: paymentMethod,
        }),
      });

      if (isBuyNowMode) {
        setBuyNowItem(null);
      } else {
        await refreshCart();
      }
      setPlacedModal(res);
    } catch (err: any) {
      notify(err.message || 'Checkout failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimUtr = async () => {
    if (!placedModal) return;
    setClaimingUtr(true);
    try {
      await apiFetch(`/api/orders/${placedModal.order.order_number}/claim-upi`, {
        method: 'POST',
        body: JSON.stringify({
          utr_reference: utrInput.trim() || 'Sent via WhatsApp',
          mobile: placedModal.order.customer_mobile,
        }),
      });
      setClaimSent(true);
      setPlacedModal({
        ...placedModal,
        order: { ...placedModal.order, payment_status: 'payment_claimed' },
      });
      notify('Payment reference noted! Click "Contact on WhatsApp" below to share your screenshot for store verification.');
    } catch (err: any) {
      notify(err.message || 'Could not record UTR', 'error');
    } finally {
      setClaimingUtr(false);
    }
  };

  const handleWhatsAppPanIndia = async () => {
    if (!name || !mobile || !addressLine || !city || !stateName || !pincode) {
      notify('Please enter your name, mobile, and address details first.', 'error');
      return;
    }
    try {
      const res = await apiFetch<{ order_number: string; whatsapp_url: string }>('/api/whatsapp-enquiry', {
        method: 'POST',
        body: JSON.stringify({
          customer_name: name,
          customer_mobile: mobile,
          address_line: addressLine,
          city,
          state: stateName,
          pincode,
          items: checkoutItems.map((it) => ({
            product_id: it.product_id,
            variant_id: it.variant_id,
            product_title: it.title,
            sku: it.sku,
            size: it.size,
            color: it.color,
            quantity: it.quantity,
            unit_price: it.unit_price,
          })),
          notes: instructions,
        }),
      });
      notify(`Enquiry ${res.order_number} saved. Opening WhatsApp...`);
      window.location.href = res.whatsapp_url;
    } catch (err: any) {
      notify(err.message || 'Could not create WhatsApp enquiry', 'error');
    }
  };

  if (checkoutItems.length === 0 && !placedModal) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="ag-heading text-3xl font-semibold">Nothing to Checkout</h1>
        <Link to="/products" className="mt-5 inline-block px-7 py-3 text-sm ag-btn-primary">
          Explore Store
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="pb-5 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--ag-border)' }}>
        <div>
          <h1 className="ag-heading text-2xl sm:text-3xl font-semibold">
            {isBuyNowMode ? 'Express Checkout (Buy Now)' : 'Checkout'}
          </h1>
          {isBuyNowMode && (
            <p className="text-xs mt-1" style={{ color: 'var(--ag-muted)' }}>
              Direct checkout for 1 item — your existing shopping bag ({cart.item_count} item{cart.item_count === 1 ? '' : 's'}) remains safe.
            </p>
          )}
        </div>
        {isBuyNowMode && (
          <Link to="/cart" className="text-xs underline" style={{ color: 'var(--ag-muted)' }}>
            Switch to Shopping Bag Checkout
          </Link>
        )}
      </div>

      <form onSubmit={handleCheckoutSubmit} className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          {savedAddresses.length > 0 && (
            <div className="ag-store-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ag-muted)' }}>
                Saved Addresses
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedAddresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => {
                      setName(addr.full_name);
                      setMobile(addr.mobile);
                      setAddressLine(addr.address_line);
                      setLocality(addr.locality);
                      setCity(addr.city);
                      setStateName(addr.state);
                      setPincode(addr.pincode);
                    }}
                    className="text-left p-3 border text-xs cursor-pointer bg-white text-[#111827]"
                    style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
                  >
                    <p className="font-semibold">{addr.full_name}</p>
                    <p className="text-[#525866] mt-0.5">{addr.address_line}, {addr.city} - {addr.pincode}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Local Delivery Area Selector */}
          {zones.length > 0 && (
            <div className="ag-store-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: 'var(--ag-accent)' }} />
                <p className="text-xs font-semibold uppercase tracking-wider">Quick Select Bulandshahr Region (20–30 km)</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {zones.map((z) => {
                  const active = pincode === z.pincode;
                  return (
                    <button
                      key={z.pincode}
                      type="button"
                      onClick={() => {
                        setPincode(z.pincode);
                        setCity(z.city || z.town_name || 'Bulandshahr');
                        setStateName(z.state || 'Uttar Pradesh');
                        if (!locality) setLocality(z.area_name);
                      }}
                      className="px-3 py-1.5 text-xs border cursor-pointer transition-colors"
                      style={
                        active
                          ? { backgroundColor: 'var(--ag-btn-bg)', color: 'var(--ag-btn-text)', borderColor: 'var(--ag-btn-bg)', borderRadius: 'var(--ag-btn-radius)' }
                          : { backgroundColor: '#fff', color: '#111827', borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }
                      }
                    >
                      {z.town_name || z.area_name} · {z.pincode}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="ag-store-card p-6 space-y-4">
            <h2 className="ag-heading text-xl font-semibold">Delivery Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Full Name *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Mobile Number *</label>
                <input required value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91" className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Email Address (Optional)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">House / Street Address *</label>
              <input required value={addressLine} onChange={(e) => setAddressLine(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Locality / Colony *</label>
                <input required value={locality} onChange={(e) => setLocality(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">PIN Code *</label>
                <input required maxLength={6} value={pincode} onChange={(e) => setPincode(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm tabular-nums" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">City *</label>
                <input required value={city} onChange={(e) => setCity(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">State *</label>
                <input required value={stateName} onChange={(e) => setStateName(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Delivery Instructions</label>
              <input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Landmark or preferred delivery timing" className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
            </div>

            {pinResult?.serviceable && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                <Truck className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    Local Delivery Available: {pinResult.details.town_name || pinResult.details.area_name} ({pinResult.details.estimated_days})
                  </p>
                  <p className="mt-0.5">
                    Fee: {baseShippingFee === 0 ? 'FREE' : formatINR(baseShippingFee)}
                    {pinResult.details.free_delivery_above ? ` · Free above ${formatINR(pinResult.details.free_delivery_above)}` : ''}
                    {pinResult.details.min_order_value > 0 ? ` · Min Order ${formatINR(pinResult.details.min_order_value)}` : ''}
                  </p>
                </div>
              </div>
            )}

            {minOrderGap > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900">
                Add {formatINR(minOrderGap)} more to meet the minimum order value for {pinResult?.details?.town_name || pincode}.
              </div>
            )}

            {/* Outside Local Zone Fallback */}
            {pinResult && !pinResult.serviceable && (
              <div className="p-4 ag-store-surface border text-xs space-y-3" style={{ borderColor: 'var(--ag-accent)' }}>
                <p className="font-semibold">PIN Code {pincode} requires Pan-India WhatsApp Confirmation</p>
                <p style={{ color: 'var(--ag-muted)' }}>
                  Direct local checkout covers Bulandshahr &amp; configured surrounding towns (20–30 km). You can submit this order as a Pan-India WhatsApp Enquiry and our team will confirm courier availability &amp; charges.
                </p>
                <button
                  type="button"
                  onClick={handleWhatsAppPanIndia}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium cursor-pointer ag-btn-primary"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send Pan-India Order Enquiry on WhatsApp</span>
                </button>
              </div>
            )}
          </div>

          {/* Shipping & Payment */}
          <div className="ag-store-card p-6 space-y-4">
            <h2 className="ag-heading text-xl font-semibold">Delivery &amp; Payment Method</h2>

            {bootstrap?.shipping_methods && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ag-muted)' }}>
                  Shipping Option
                </p>
                {bootstrap.shipping_methods.map((sm) => (
                  <label key={sm.id} className="flex items-center justify-between p-3 border text-sm cursor-pointer bg-white text-[#111827]" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={shippingMethodId === sm.id || (!shippingMethodId && sm.base_fee > 0)}
                        onChange={() => setShippingMethodId(sm.id)}
                      />
                      <div>
                        <p className="font-medium">{sm.name}</p>
                        <p className="text-xs text-[#525866]">{sm.estimated_time}</p>
                      </div>
                    </div>
                    <span className="tabular-nums text-xs font-semibold">
                      {sm.base_fee === 0 ? 'Free' : formatINR(baseShippingFee)}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ag-muted)' }}>
                Select Payment Method
              </p>

              <label
                className={`flex items-start justify-between p-3.5 border bg-white text-[#111827] ${
                  codEnabled && (pinResult?.details?.cod_allowed ?? 1) ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                }`}
                style={{
                  borderColor: paymentMethod === 'COD' ? 'var(--ag-ink)' : 'var(--ag-border)',
                  borderRadius: 'var(--ag-btn-radius)',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="pay"
                    disabled={!codEnabled || (pinResult?.serviceable && !pinResult.details.cod_allowed)}
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-semibold">Cash on Delivery (COD)</p>
                    <p className="text-xs text-[#525866] mt-0.5">
                      Pay cash or scan QR upon delivery at your doorstep or showroom pickup.
                    </p>
                  </div>
                </div>
              </label>

              <label
                className={`block p-3.5 border bg-white text-[#111827] ${
                  upiEnabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                }`}
                style={{
                  borderColor: paymentMethod === 'UPI_WHATSAPP' ? 'var(--ag-ink)' : 'var(--ag-border)',
                  borderRadius: 'var(--ag-btn-radius)',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="pay"
                    disabled={!upiEnabled}
                    checked={paymentMethod === 'UPI_WHATSAPP'}
                    onChange={() => setPaymentMethod('UPI_WHATSAPP')}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">UPI / Pay via WhatsApp</p>
                      <QrCode className="w-4 h-4 text-[#15803D]" />
                    </div>
                    <p className="text-xs text-[#525866] mt-0.5">
                      Scan our official UPI QR after placing the order, download your Proforma Order Summary PDF, and send your payment screenshot on WhatsApp for manual verification by our store team.
                    </p>
                    {paymentMethod === 'UPI_WHATSAPP' && (paySettings?.upi_qr_url || paySettings?.upi_id) && (
                      <div className="mt-3 p-3 bg-[#F9FAFB] border border-[#E5E7EB] flex flex-wrap items-center gap-4 text-xs">
                        {paySettings?.upi_qr_url && (
                          <img
                            src={paySettings.upi_qr_url}
                            alt="Arora Garments Official UPI QR"
                            className="w-20 h-20 object-contain bg-white border p-1"
                          />
                        )}
                        <div className="space-y-1">
                          <p className="font-semibold">{paySettings?.upi_payee_name || 'ARORA GARMENTS'}</p>
                          {paySettings?.upi_id && (
                            <p className="font-mono text-[#111827]">UPI ID: {paySettings.upi_id}</p>
                          )}
                          <p className="text-[#525866]">Order remains pending verification until confirmed by our admin team.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Summary */}
        <div className="lg:col-span-5">
          <div className="ag-store-card p-6 space-y-4 sticky top-24">
            <h2 className="ag-heading text-xl font-semibold">{isBuyNowMode ? 'Buy Now Summary' : 'Bag Review'}</h2>
            <div className="divide-y max-h-72 overflow-y-auto" style={{ borderColor: 'var(--ag-border)' }}>
              {checkoutItems.map((it) => (
                <div key={it.variant_id} className="py-3 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{it.title}</p>
                    <p className="text-xs" style={{ color: 'var(--ag-muted)' }}>
                      {it.size} / {it.color} × {it.quantity}
                    </p>
                    {isBuyNowMode && (
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        <span>Qty:</span>
                        <button
                          type="button"
                          onClick={() => setBuyNowQty((q) => Math.max(1, q - 1))}
                          className="px-2 py-0.5 border cursor-pointer"
                        >
                          −
                        </button>
                        <span className="tabular-nums font-medium">{buyNowQty}</span>
                        <button
                          type="button"
                          onClick={() => setBuyNowQty((q) => Math.min(it.quantity_available, q + 1))}
                          className="px-2 py-0.5 border cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="tabular-nums font-semibold">{formatINR(it.line_total)}</span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t space-y-2 text-sm tabular-nums" style={{ borderColor: 'var(--ag-border)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--ag-muted)' }}>Subtotal</span>
                <span>{formatINR(itemsSubtotal)}</span>
              </div>
              {estDiscount > 0 && (
                <div className="flex justify-between text-[#15803D]">
                  <span>Coupon Discount ({couponCode})</span>
                  <span>− {formatINR(estDiscount)}</span>
                </div>
              )}
              {previewPricing?.gst?.gst_enabled && estTax > 0 && (
                <div className="p-2.5 bg-[#F9FAFB] border border-[#E5E7EB] space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#525866]">Taxable Value</span>
                    <span>{formatINR(previewPricing.taxable_amount)}</span>
                  </div>
                  {previewPricing.cgst_amount > 0 || previewPricing.sgst_amount > 0 ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[#525866]">CGST</span>
                        <span>{formatINR(previewPricing.cgst_amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#525866]">SGST</span>
                        <span>{formatINR(previewPricing.sgst_amount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-[#525866]">IGST</span>
                      <span>{formatINR(previewPricing.igst_amount)}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-[#525866]">
                    {previewPricing.gst.tax_calculation_mode === 'inclusive'
                      ? 'GST included in product prices'
                      : 'GST added (tax-exclusive)'}
                  </p>
                </div>
              )}
              <div className="flex justify-between">
                <span style={{ color: 'var(--ag-muted)' }}>Shipping</span>
                <span>{baseShippingFee === 0 ? 'Free' : formatINR(baseShippingFee)}</span>
              </div>
              <div className="pt-3 border-t flex justify-between text-base font-bold" style={{ borderColor: 'var(--ag-border)' }}>
                <span>Total Payable</span>
                <span>{formatINR(estGrandTotal)}</span>
              </div>
            </div>

            <p className="text-xs" style={{ color: 'var(--ag-muted)' }}>
              By placing this order, you agree to our{' '}
              <Link to="/return-policy" className="underline">Return &amp; Refund Policy</Link> and{' '}
              <Link to="/shipping-policy" className="underline">Shipping Policy</Link>.
            </p>

            <button
              type="submit"
              disabled={submitting || minOrderGap > 0 || (pinResult !== null && !pinResult.serviceable)}
              className="w-full py-3.5 text-sm font-semibold hover:opacity-90 disabled:opacity-45 transition-opacity cursor-pointer ag-btn-primary"
            >
              {submitting
                ? 'Creating Order...'
                : paymentMethod === 'UPI_WHATSAPP'
                  ? `Create Pending Order & Pay via UPI (${formatINR(estGrandTotal)})`
                  : `Place COD Order (${formatINR(estGrandTotal)})`}
            </button>
          </div>
        </div>
      </form>

      {/* Order Confirmation Modal */}
      {placedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 overflow-y-auto">
          <div className="bg-white text-[#111827] max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-[#E5E7EB]" style={{ borderRadius: 'var(--ag-radius)' }}>
            <div className="flex items-start justify-between gap-4 border-b border-[#E5E7EB] pb-4">
              <div>
                <div className="flex items-center gap-2 text-[#15803D]">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-xs uppercase tracking-wider font-semibold">
                    {placedModal.order.payment_method === 'UPI_WHATSAPP'
                      ? 'Pending Order Created — Complete UPI Payment'
                      : 'Order Confirmed'}
                  </span>
                </div>
                <h2 className="mt-1.5 ag-heading text-2xl font-bold">Order {placedModal.order.order_number}</h2>
                <p className="text-xs text-[#525866] mt-0.5">
                  Document: <span className="font-mono">{placedModal.order.invoice_number}</span> · Amount:{' '}
                  <strong className="tabular-nums text-[#111827]">{formatINR(placedModal.order.grand_total)}</strong>
                </p>
              </div>
              <span className={`px-2.5 py-1 text-[11px] font-medium border ${paymentStatusBadgeClass(placedModal.order.payment_status)}`}>
                {paymentStatusLabel(placedModal.order.payment_status)}
              </span>
            </div>

            {placedModal.order.payment_method === 'UPI_WHATSAPP' && (
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] p-4 space-y-3 text-xs">
                <p className="font-semibold text-sm">Complete Payment via Official UPI QR &amp; WhatsApp</p>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  {placedModal.payment_settings.upi_qr_url ? (
                    <img
                      src={placedModal.payment_settings.upi_qr_url}
                      alt="Official Arora Garments UPI QR"
                      className="w-36 h-36 object-contain bg-white border p-1.5 shrink-0"
                    />
                  ) : (
                    <div className="w-36 h-36 bg-white border flex flex-col items-center justify-center text-center p-2 text-[#525866]">
                      <QrCode className="w-8 h-8 mb-1 opacity-60" />
                      <span>Use UPI ID or request QR on WhatsApp</span>
                    </div>
                  )}
                  <div className="space-y-2 flex-1">
                    <p><strong>Payee:</strong> {placedModal.payment_settings.upi_payee_name || 'ARORA GARMENTS'}</p>
                    {placedModal.payment_settings.upi_id && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">{placedModal.payment_settings.upi_id}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(placedModal.payment_settings.upi_id);
                            notify('UPI ID copied');
                          }}
                          className="p-1 border bg-white cursor-pointer"
                          title="Copy UPI ID"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <p className="text-[#525866] leading-relaxed">
                      {placedModal.payment_settings.upi_instructions ||
                        'Pay the exact total above, download your Proforma Order Summary PDF, then submit your UTR or open WhatsApp to send the payment screenshot. Our team will manually verify and confirm your order.'}
                    </p>
                  </div>
                </div>

                {!claimSent ? (
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <input
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="Enter UPI UTR / Transaction Ref (optional)"
                      className="flex-1 border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-mono"
                    />
                    <button
                      type="button"
                      disabled={claimingUtr}
                      onClick={handleClaimUtr}
                      className="px-4 py-2 bg-[#15803D] text-white font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{claimingUtr ? 'Saving...' : "I've Paid · Send Screenshot on WhatsApp"}</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-[#15803D] font-medium">
                    Payment claim recorded! Awaiting manual verification by ARORA GARMENTS staff.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={async () => {
                  setDownloadingPdf(true);
                  try {
                    await downloadInvoicePdf(
                      placedModal.order.order_number,
                      placedModal.order.customer_mobile,
                      placedModal.order.is_proforma
                        ? `PROFORMA-${placedModal.order.order_number}`
                        : placedModal.order.invoice_number
                    );
                  } catch (err: any) {
                    notify(err.message || 'Could not download invoice PDF', 'error');
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#111827] text-white font-medium cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-4 h-4" />
                <span>{downloadingPdf ? 'Downloading...' : 'Download Order Summary PDF'}</span>
              </button>
              <a
                href={placedModal.whatsapp_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#15803D] text-white font-medium"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contact on WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => navigate(`/track-order?orderNumber=${encodeURIComponent(placedModal.order.order_number)}`)}
                className="inline-flex items-center justify-center px-4 py-2.5 border border-[#111827] font-medium cursor-pointer"
              >
                Track Order
              </button>
              <button
                type="button"
                onClick={() => navigate(`/order-confirmation/${placedModal.order.order_number}?mobile=${encodeURIComponent(placedModal.order.customer_mobile)}`)}
                className="inline-flex items-center justify-center px-4 py-2.5 border border-[#E5E7EB] font-medium cursor-pointer"
              >
                View Order
              </button>
            </div>

            <div className="pt-2 border-t border-[#E5E7EB] text-center">
              <Link to="/products" className="inline-flex items-center gap-1.5 text-xs font-medium underline">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Continue Shopping</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function OrderConfirmationPage() {
  const { orderNumber } = useParams();
  const { bootstrap, user, notify } = useStore();
  const mobile = new URLSearchParams(window.location.search).get('mobile') || '';
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [utrInput, setUtrInput] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const loadOrder = () => {
    if (!orderNumber) return;
    apiFetch<{ order: OrderRecord }>(
      `/api/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&mobile=${encodeURIComponent(mobile)}`
    )
      .then((res) => setOrder(res.order))
      .catch(() => {});
  };

  useEffect(loadOrder, [orderNumber, mobile]);

  const paySettings = bootstrap?.payment_settings;
  const waNumber = (bootstrap?.business_info?.whatsapp_primary || '919897694349').replace(/\D/g, '');
  const waText = order
    ? `Namaste ARORA GARMENTS, regarding my order *${order.order_number}* (Amount: ₹${order.grand_total}).${utrInput ? ` UTR Ref: ${utrInput}.` : ''} Please assist / verify.`
    : `Namaste ARORA GARMENTS, regarding my order ${orderNumber}.`;
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setClaiming(true);
    try {
      await apiFetch(`/api/orders/${order.order_number}/claim-upi`, {
        method: 'POST',
        body: JSON.stringify({ utr_reference: utrInput.trim() || 'Sent via WhatsApp', mobile }),
      });
      notify('Payment reference saved — click "Contact on WhatsApp" below to share your payment screenshot.');
      loadOrder();
    } catch (err: any) {
      notify(err.message || 'Could not save reference', 'error');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="ag-store-card p-6 sm:p-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[#15803D]">
            <CheckCircle2 className="w-6 h-6" />
            <p className="text-xs uppercase tracking-[0.12em] font-semibold">
              {order?.payment_method === 'UPI_WHATSAPP' && order?.payment_status !== 'paid'
                ? 'Order Created — Pending Payment Verification'
                : 'Order Placed Successfully'}
            </p>
          </div>
          {order && (
            <span className={`px-2.5 py-1 text-xs font-medium border ${paymentStatusBadgeClass(order.payment_status)}`}>
              {paymentStatusLabel(order.payment_status)}
            </span>
          )}
        </div>

        <div>
          <h1 className="ag-heading text-2xl sm:text-3xl font-bold">
            Thank you{order ? `, ${order.customer_name}` : ''}
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--ag-muted)' }}>
            Order ID: <span className="font-mono font-semibold" style={{ color: 'var(--ag-ink)' }}>{orderNumber}</span>
            {order && (
              <>
                {' '}· {order.is_proforma ? 'Proforma Ref' : 'Invoice'}: <span className="font-mono">{order.invoice_number}</span>
              </>
            )}
          </p>
        </div>

        {order && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y text-xs" style={{ borderColor: 'var(--ag-border)' }}>
              <div>
                <p style={{ color: 'var(--ag-muted)' }}>Order Status</p>
                <p className="mt-1 font-semibold">{order.order_status}</p>
              </div>
              <div>
                <p style={{ color: 'var(--ag-muted)' }}>Payment Method</p>
                <p className="mt-1 font-semibold">{paymentMethodLabel(order.payment_method)}</p>
              </div>
              <div>
                <p style={{ color: 'var(--ag-muted)' }}>Total Amount</p>
                <p className="mt-1 font-bold tabular-nums">{formatINR(order.grand_total)}</p>
              </div>
              <div>
                <p style={{ color: 'var(--ag-muted)' }}>Delivery PIN</p>
                <p className="mt-1 font-semibold tabular-nums">{order.shipping_address.pincode}</p>
              </div>
            </div>

            {order.items && order.items.length > 0 && (
              <div className="divide-y text-sm" style={{ borderColor: 'var(--ag-border)' }}>
                {order.items.map((it) => (
                  <div key={it.id} className="py-2.5 flex justify-between gap-4">
                    <div>
                      <p className="font-medium">{it.product_title}</p>
                      <p className="text-xs" style={{ color: 'var(--ag-muted)' }}>
                        {it.size} / {it.color} × {it.quantity}
                      </p>
                    </div>
                    <span className="tabular-nums font-medium">{formatINR(it.line_total)}</span>
                  </div>
                ))}
              </div>
            )}

            {order.payment_method === 'UPI_WHATSAPP' && order.payment_status !== 'paid' && (
              <form onSubmit={handleClaim} className="p-4 ag-store-surface border space-y-3 text-xs" style={{ borderColor: 'var(--ag-border)' }}>
                <p className="font-semibold text-sm">UPI Payment &amp; Screenshot Verification</p>
                {paySettings?.upi_qr_url && (
                  <div className="flex flex-wrap items-center gap-4">
                    <img src={paySettings.upi_qr_url} alt="UPI QR" className="w-28 h-28 object-contain bg-white border p-1" />
                    <div className="space-y-1">
                      <p className="font-semibold">{paySettings.upi_payee_name}</p>
                      {paySettings.upi_id && <p className="font-mono">{paySettings.upi_id}</p>}
                      <p style={{ color: 'var(--ag-muted)' }}>{paySettings.upi_instructions}</p>
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    placeholder={order.payment_reference ? `Submitted: ${order.payment_reference}` : 'Enter UPI UTR / Ref ID (optional)'}
                    className="flex-1 border bg-white text-[#111827] px-3 py-2 text-xs font-mono"
                    style={{ borderColor: 'var(--ag-border)' }}
                  />
                  <button
                    type="submit"
                    disabled={claiming}
                    className="px-4 py-2 bg-[#15803D] text-white font-semibold cursor-pointer whitespace-nowrap"
                  >
                    {claiming ? 'Saving...' : 'Submit UTR & Open WhatsApp'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-wrap gap-2.5 text-xs">
              <Link
                to={`/track-order?orderNumber=${encodeURIComponent(order.order_number)}`}
                className="inline-flex items-center px-4 py-2.5 font-medium ag-btn-primary"
              >
                Track Order
              </Link>
              <Link
                to={user ? `/orders/${order.id}` : `/track-order?orderNumber=${encodeURIComponent(order.order_number)}`}
                className="inline-flex items-center px-4 py-2.5 font-medium ag-btn-secondary"
              >
                View Order
              </Link>
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={async () => {
                  setDownloadingPdf(true);
                  try {
                    await downloadInvoicePdf(
                      order.order_number,
                      mobile,
                      order.is_proforma ? `PROFORMA-${order.order_number}` : order.invoice_number
                    );
                  } catch (err: any) {
                    notify(err.message || 'Could not download invoice PDF', 'error');
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 font-medium ag-btn-secondary cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-4 h-4" />
                <span>{downloadingPdf ? 'Downloading...' : 'Download Order Summary'}</span>
              </button>
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#15803D] text-white font-medium"
                style={{ borderRadius: 'var(--ag-btn-radius)' }}
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contact on WhatsApp</span>
              </a>
              <Link
                to="/products"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 font-medium ag-btn-secondary"
              >
                Continue Shopping
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
