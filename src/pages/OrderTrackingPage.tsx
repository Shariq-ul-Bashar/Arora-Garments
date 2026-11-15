import React, { useEffect, useState } from 'react';
import { ExternalLink, FileDown, MessageCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  apiFetch,
  downloadInvoicePdf,
  formatINR,
  paymentMethodLabel,
  paymentStatusBadgeClass,
  paymentStatusLabel,
} from '../lib/api';
import type { OrderRecord } from '../types';

const TIMELINE_STEPS = [
  'Pending Confirmation',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
];

export function OrderTrackingPage() {
  const { bootstrap, notify } = useStore();
  const initialOrder = new URLSearchParams(window.location.search).get('orderNumber') || '';
  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [mobile, setMobile] = useState('');
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [utrRef, setUtrRef] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchTracking = async (oNum: string, mob: string) => {
    if (!oNum.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ order: OrderRecord }>(
        `/api/orders/track?orderNumber=${encodeURIComponent(oNum.trim())}&mobile=${encodeURIComponent(mob.trim())}`
      );
      setOrder(res.order);
    } catch (err: any) {
      setOrder(null);
      setError(err.message || 'Could not locate order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrder) {
      fetchTracking(initialOrder, '');
    }
  }, [initialOrder]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTracking(orderNumber, mobile);
  };

  const handleClaimUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setClaiming(true);
    try {
      await apiFetch(`/api/orders/${order.order_number}/claim-upi`, {
        method: 'POST',
        body: JSON.stringify({ utr_reference: utrRef.trim() || 'Sent via WhatsApp', mobile }),
      });
      notify('Payment reference noted for manual verification.');
      await fetchTracking(order.order_number, mobile);
    } catch (err: any) {
      notify(err.message || 'Failed to record payment reference', 'error');
    } finally {
      setClaiming(false);
    }
  };

  const activeIdx = order ? TIMELINE_STEPS.indexOf(order.order_status) : -1;
  const waNumber = (bootstrap?.business_info?.whatsapp_primary || '919897694349').replace(/\D/g, '');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="ag-heading text-2xl sm:text-3xl font-semibold">Track Your Order</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--ag-muted)' }}>
        Enter your Order ID (e.g. AG-123456) and registered mobile number to view live fulfillment &amp; payment verification progress.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 ag-store-card p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <input
          required
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order ID (e.g. AG-...)"
          className="border bg-white text-[#111827] px-3 py-2.5 text-sm font-mono"
          style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
        />
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="Registered Mobile Number"
          className="border bg-white text-[#111827] px-3 py-2.5 text-sm tabular-nums"
          style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
        />
        <button type="submit" disabled={loading} className="text-sm font-medium py-2.5 cursor-pointer ag-btn-primary">
          {loading ? 'Checking...' : 'Track Order'}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-[#991B1B]">{error}</p>}

      {order && (
        <div className="mt-8 ag-store-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--ag-border)' }}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-base font-bold">{order.order_number}</p>
                <span className={`px-2 py-0.5 text-[11px] font-medium border ${paymentStatusBadgeClass(order.payment_status)}`}>
                  {paymentStatusLabel(order.payment_status)}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--ag-muted)' }}>
                Placed {new Date(order.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} ·{' '}
                {paymentMethodLabel(order.payment_method)} · Total{' '}
                <span className="tabular-nums font-semibold" style={{ color: 'var(--ag-ink)' }}>
                  {formatINR(order.grand_total)}
                </span>
              </p>
            </div>
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
                  notify(err.message || 'Could not download PDF invoice', 'error');
                } finally {
                  setDownloadingPdf(false);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium ag-btn-secondary cursor-pointer disabled:opacity-50"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{downloadingPdf ? 'Downloading...' : order.is_proforma ? 'Proforma Summary PDF' : 'Invoice PDF'}</span>
            </button>
          </div>

          {order.gst_breakdown?.gst_enabled && Number(order.tax_amount || 0) > 0 && (
            <div className="p-3 ag-store-surface border text-xs flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--ag-border)' }}>
              <span style={{ color: 'var(--ag-muted)' }}>
                Taxable: <strong className="tabular-nums text-[#111827]">{formatINR(order.taxable_amount || 0)}</strong>
              </span>
              {Number(order.cgst_amount || 0) > 0 || Number(order.sgst_amount || 0) > 0 ? (
                <span className="tabular-nums">
                  CGST: <strong>{formatINR(order.cgst_amount || 0)}</strong> · SGST: <strong>{formatINR(order.sgst_amount || 0)}</strong>
                </span>
              ) : (
                <span className="tabular-nums">
                  IGST: <strong>{formatINR(order.igst_amount || 0)}</strong>
                </span>
              )}
            </div>
          )}

          {order.payment_method === 'UPI_WHATSAPP' && ['awaiting_payment', 'rejected'].includes(order.payment_status) && (
            <form onSubmit={handleClaimUpi} className="p-4 ag-store-surface border text-xs space-y-2.5" style={{ borderColor: 'var(--ag-border)' }}>
              <p className="font-semibold">Already paid via UPI? Submit UTR Reference &amp; Share Screenshot</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={utrRef}
                  onChange={(e) => setUtrRef(e.target.value)}
                  placeholder="Enter UPI UTR / Transaction Reference"
                  className="flex-1 border bg-white text-[#111827] px-3 py-2 font-mono"
                  style={{ borderColor: 'var(--ag-border)' }}
                />
                <button type="submit" disabled={claiming} className="px-4 py-2 font-semibold cursor-pointer ag-btn-primary">
                  {claiming ? 'Submitting...' : 'Submit Reference'}
                </button>
                <a
                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Namaste ARORA GARMENTS, sharing UPI screenshot for Order ${order.order_number} (₹${order.grand_total}).`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#15803D] text-white font-semibold"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Screenshot</span>
                </a>
              </div>
            </form>
          )}

          {/* 7-Step Progress Bar */}
          {activeIdx >= 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-3">
              {TIMELINE_STEPS.map((step, i) => {
                const done = i <= activeIdx;
                return (
                  <div key={step} className="flex flex-col gap-1.5">
                    <div
                      className="h-1.5"
                      style={{ backgroundColor: done ? 'var(--ag-primary)' : 'var(--ag-border)' }}
                    />
                    <span
                      className={`text-[11px] leading-tight ${done ? 'font-semibold' : ''}`}
                      style={{ color: done ? 'var(--ag-ink)' : 'var(--ag-muted)' }}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 ag-store-surface text-sm font-medium">Current Status: {order.order_status}</div>
          )}

          {/* Courier Information */}
          {(order.courier_partner || order.tracking_number || order.expected_delivery_date) && (
            <div className="p-4 border ag-store-surface text-xs space-y-1.5" style={{ borderColor: 'var(--ag-border)' }}>
              <p className="font-semibold uppercase tracking-wider" style={{ color: 'var(--ag-muted)' }}>Shipment Details</p>
              {order.courier_partner && <p>Courier Partner: <strong>{order.courier_partner}</strong></p>}
              {order.tracking_number && <p>Tracking Number: <span className="font-mono font-semibold">{order.tracking_number}</span></p>}
              {order.expected_delivery_date && <p>Expected Delivery: <strong>{order.expected_delivery_date}</strong></p>}
              {order.tracking_url && (
                <a href={order.tracking_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline pt-1" style={{ color: 'var(--ag-accent)' }}>
                  <span>Open Courier Tracking</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Status History */}
          {order.history && order.history.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider font-semibold mb-3" style={{ color: 'var(--ag-muted)' }}>
                Status Timeline
              </h3>
              <div className="space-y-3 text-xs">
                {order.history.map((h, idx) => (
                  <div key={idx} className="flex justify-between gap-4 py-2 border-b" style={{ borderColor: 'var(--ag-border)' }}>
                    <div>
                      <p className="font-semibold">{h.status}</p>
                      {h.note && <p className="mt-0.5" style={{ color: 'var(--ag-muted)' }}>{h.note}</p>}
                    </div>
                    <span className="tabular-nums shrink-0" style={{ color: 'var(--ag-muted)' }}>
                      {new Date(h.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
