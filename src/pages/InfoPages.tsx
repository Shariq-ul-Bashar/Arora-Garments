import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Instagram, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';

function PageFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="pb-6 border-b" style={{ borderColor: 'var(--ag-border)' }}>
        <p className="text-xs uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--ag-accent)' }}>
          ARORA GARMENTS
        </p>
        <h1 className="mt-2 ag-heading text-3xl sm:text-4xl font-semibold">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm" style={{ color: 'var(--ag-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="pt-8 space-y-6 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function AboutPage() {
  const { bootstrap } = useStore();
  const biz = bootstrap?.business_info;
  return (
    <PageFrame title="About ARORA GARMENTS" subtitle="Ultimate Fashion Destination · Family Fashion & Readymade Garments">
      <p>
        Located in Faislabad, Bulandshahr (Uttar Pradesh), <strong>{biz?.brand_name || 'ARORA GARMENTS'}</strong> serves families
        across Bulandshahr and nearby towns with curated readymade garments and footwear across four dedicated departments:
        Men&apos;s Wear, Women&apos;s Wear, Kids Wear, and Footwear.
      </p>
      <p>
        Our physical showroom at {biz?.address_line || 'CV59+RH9, Faislabad'}, {biz?.city || 'Bulandshahr'},{' '}
        {biz?.state || 'Uttar Pradesh'} {biz?.pincode || '203001'} welcomes shoppers seven days a week from 10:00 AM to 8:30 PM.
      </p>
      <div className="pt-4">
        <Link to="/products" className="inline-block px-6 py-3 ag-btn-primary text-xs font-medium">
          Browse Our Departments
        </Link>
      </div>
    </PageFrame>
  );
}

export function HowToOrderPage() {
  return (
    <PageFrame title="How to Order" subtitle="Local Bulandshahr Region Checkout & Pan-India WhatsApp Ordering">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="ag-store-card p-6 space-y-2">
          <h2 className="ag-heading text-xl font-semibold">1. Local Bulandshahr Website Checkout</h2>
          <p style={{ color: 'var(--ag-muted)' }}>
            Add garments in your preferred size and colour to your bag or click Buy Now. Select your Bulandshahr or nearby serviceable town
            PIN code (including Sikandrabad, Khurja, Jahangirabad, Siyana, Gulaothi, Shikarpur &amp; Anupshahr) and pay via Cash on Delivery (COD)
            or UPI / Pay via WhatsApp.
          </p>
        </div>
        <div className="ag-store-card p-6 space-y-2">
          <h2 className="ag-heading text-xl font-semibold">2. Pan-India Orders via WhatsApp</h2>
          <p style={{ color: 'var(--ag-muted)' }}>
            Ordering from outside our local 20–30 km delivery radius? Submit your product selection and PIN code via our WhatsApp Order Enquiry flow.
            Our team confirms stock availability and courier charges before finalizing your order.
          </p>
        </div>
      </div>
    </PageFrame>
  );
}

export function ContactPage() {
  const { bootstrap, notify } = useStore();
  const biz = bootstrap?.business_info;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({ name, phone, message }),
      });
      setName('');
      setPhone('');
      setMessage('');
      notify('Message sent to store team');
    } catch (err: any) {
      notify(err.message || 'Could not send message', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <PageFrame title="Contact Us" subtitle="Speak directly with our Bulandshahr showroom team">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="ag-store-card p-6 space-y-4">
          <h2 className="ag-heading text-xl font-semibold">{biz?.brand_name || 'ARORA GARMENTS'}</h2>
          <div className="space-y-3 text-sm" style={{ color: 'var(--ag-muted)' }}>
            <p className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 shrink-0 mt-1" style={{ color: 'var(--ag-ink)' }} />
              <span>
                {biz?.address_line || 'CV59+RH9, Faislabad'}, {biz?.city || 'Bulandshahr'}, {biz?.state || 'Uttar Pradesh'}{' '}
                {biz?.pincode || '203001'}, {biz?.country || 'India'}
              </span>
            </p>
            <p className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--ag-ink)' }} />
              <span>{biz?.operating_hours || 'Monday – Sunday, 10:00 AM – 8:30 PM'}</span>
            </p>
            <div className="flex items-start gap-2.5 tabular-nums">
              <Phone className="w-4 h-4 shrink-0 mt-1" style={{ color: 'var(--ag-ink)' }} />
              <div className="flex flex-col">
                <a href={`tel:${biz?.primary_phone || '+919897694349'}`} className="font-medium hover:underline" style={{ color: 'var(--ag-ink)' }}>
                  {biz?.primary_phone || '+91 9897694349'}
                </a>
                <a href={`tel:${biz?.secondary_phone || '+919759147004'}`} className="font-medium hover:underline" style={{ color: 'var(--ag-ink)' }}>
                  {biz?.secondary_phone || '+91 9759147004'}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Instagram className="w-4 h-4 shrink-0 mt-1" style={{ color: 'var(--ag-ink)' }} />
              <div className="flex flex-col">
                <a href={biz?.instagram_1 || 'https://www.instagram.com/arora_garments001/'} target="_blank" rel="noreferrer" className="hover:underline">
                  @arora_garments001
                </a>
                <a href={biz?.instagram_2 || 'https://www.instagram.com/arora._.garments/'} target="_blank" rel="noreferrer" className="hover:underline">
                  @arora._.garments
                </a>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <a
              href={`https://wa.me/${biz?.whatsapp_primary || '919897694349'}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 ag-btn-primary text-xs font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Store</span>
            </a>
            <a
              href={biz?.maps_directions_url || 'https://share.google/kfXnT0m9qZV5sQpdK'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 ag-btn-secondary text-xs font-medium"
            >
              <MapPin className="w-4 h-4" />
              <span>Get Directions</span>
            </a>
          </div>
        </div>

        <form onSubmit={submitForm} className="ag-store-card p-6 space-y-4">
          <h2 className="ag-heading text-xl font-semibold">Send an Enquiry</h2>
          <input required placeholder="Your Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full border px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)' }} />
          <input required placeholder="Mobile / WhatsApp Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)' }} />
          <textarea required rows={4} placeholder="How can we help you?" value={message} onChange={(e) => setMessage(e.target.value)} className="w-full border px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)' }} />
          <button type="submit" disabled={sending} className="px-6 py-2.5 ag-btn-primary text-xs font-medium cursor-pointer">
            {sending ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </PageFrame>
  );
}

export function StoreLocationPage() {
  const { bootstrap } = useStore();
  const biz = bootstrap?.business_info;
  const mapQuery = encodeURIComponent(
    `${biz?.brand_name || 'Arora Garments'}, ${biz?.address_line || 'CV59+RH9, Faislabad'}, ${biz?.city || 'Bulandshahr'}, ${biz?.state || 'Uttar Pradesh'} ${biz?.pincode || '203001'}`
  );
  const directionsUrl = biz?.maps_directions_url || 'https://share.google/kfXnT0m9qZV5sQpdK';

  return (
    <PageFrame title="Store Location" subtitle="Visit our family fashion showroom in Bulandshahr">
      <div className="ag-store-card p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-semibold text-base">{biz?.brand_name || 'ARORA GARMENTS'}</p>
            <p style={{ color: 'var(--ag-muted)' }}>
              {biz?.address_line || 'CV59+RH9, Faislabad'}, {biz?.city || 'Bulandshahr'}, {biz?.state || 'Uttar Pradesh'}{' '}
              {biz?.pincode || '203001'}, {biz?.country || 'India'}
            </p>
            <p style={{ color: 'var(--ag-muted)' }}>Hours: {biz?.operating_hours || 'Monday – Sunday, 10:00 AM – 8:30 PM'}</p>
          </div>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 ag-btn-primary text-xs font-medium whitespace-nowrap"
          >
            <MapPin className="w-4 h-4" />
            <span>Open in Google Maps</span>
          </a>
        </div>
        <div className="aspect-[16/9] border overflow-hidden ag-store-surface" style={{ borderColor: 'var(--ag-border)' }}>
          <iframe
            title="Arora Garments Bulandshahr Location"
            src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>
      </div>
    </PageFrame>
  );
}

export function FaqPage() {
  const faqs = [
    ['Where does Arora Garments deliver via website checkout?', 'Local website checkout serves Bulandshahr and nearby towns within 20–30 km including 203001 (Bulandshahr City), 203002, 203205 (Sikandrabad), 203131 (Khurja), 203394 (Jahangirabad), 203395 (Shikarpur), 203129 (Anupshahr), 203407 (Siyana), and 203408 (Gulaothi).'],
    ['Can I order from another city in India?', 'Yes. Enter your PIN code during checkout to submit a Pan-India WhatsApp Order Enquiry. Our showroom team confirms stock availability and courier fee before dispatch.'],
    ['What payment methods are accepted?', 'We accept Cash on Delivery (COD) on serviceable PIN codes and UPI / Pay via WhatsApp using our official store UPI QR code & UPI ID. For UPI orders, our team manually verifies your UTR reference/WhatsApp screenshot before issuing your final Retail Invoice.'],
    ['What are your store opening hours?', 'Monday – Sunday, 10:00 AM – 8:30 PM at CV59+RH9, Faislabad, Bulandshahr, Uttar Pradesh 203001.'],
  ];
  return (
    <PageFrame title="Frequently Asked Questions">
      <div className="divide-y border-t border-b" style={{ borderColor: 'var(--ag-border)' }}>
        {faqs.map(([q, a]) => (
          <div key={q} className="py-5">
            <h3 className="font-semibold text-base">{q}</h3>
            <p className="mt-1.5" style={{ color: 'var(--ag-muted)' }}>{a}</p>
          </div>
        ))}
      </div>
    </PageFrame>
  );
}

export function ShippingPolicyPage() {
  return (
    <PageFrame title="Shipping Policy">
      <p>Local website orders within Bulandshahr and our configured 20–30 km serviceable PIN zones are delivered within 1–3 business days, or available for same-day pickup from our Faislabad showroom.</p>
      <p>Pan-India orders requested through WhatsApp are dispatched via verified courier partners once delivery charges and availability are confirmed by ARORA GARMENTS administration.</p>
    </PageFrame>
  );
}

export function ReturnPolicyPage() {
  const { bootstrap } = useStore();
  const days = bootstrap?.invoice_settings?.return_window_days || 7;
  return (
    <PageFrame title="Return & Refund Policy">
      <p>Unworn, unwashed garments and footwear with original tags and invoice may be requested for return or exchange within {days} days of delivery.</p>
      <p>Signed-in customers can submit return requests directly from My Orders → Order Details, or reach our showroom team at +91 9897694349.</p>
    </PageFrame>
  );
}

export function PrivacyPolicyPage() {
  return (
    <PageFrame title="Privacy Policy">
      <p>ARORA GARMENTS collects only the contact, delivery address, and order details necessary to fulfill your purchases, verify UPI receipts, provide customer support, and generate retail invoices.</p>
      <p>Customer order history and personal details are isolated per account.</p>
    </PageFrame>
  );
}

export function TermsPage() {
  return (
    <PageFrame title="Terms & Conditions">
      <p>All product prices are listed in Indian Rupees (INR ₹) and are subject to variant stock availability at the time of server-side checkout confirmation.</p>
      <p>Orders placed via UPI / Pay via WhatsApp remain in Proforma status until UTR or payment receipt is manually verified by ARORA GARMENTS staff.</p>
    </PageFrame>
  );
}
