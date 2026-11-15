import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, FileDown, IndianRupee, MessageCircle, Plus, Printer, XCircle } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  apiFetch,
  formatINR,
  getAuthToken,
  paymentMethodLabel,
  paymentStatusBadgeClass,
  paymentStatusLabel,
} from '../../lib/api';

const ORDER_STATUSES = [
  'Pending Confirmation',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancellation Requested',
  'Cancelled',
  'Return Requested',
  'Returned',
  'Refund Pending',
  'Refunded',
];

async function downloadFileWithAuth(url: string, filename: string, onError?: (msg: string) => void) {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { credentials: 'include', headers });
  if (!res.ok) {
    let msg = 'Could not download file';
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      // ignore
    }
    onError?.(msg);
    return;
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
}

export function AdminOrders() {
  const { notify } = useStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [manualOrder, setManualOrder] = useState({
    customer_name: '',
    customer_mobile: '',
    address_line: '',
    city: 'Bulandshahr',
    state: 'Uttar Pradesh',
    pincode: '203001',
    order_source: 'WhatsApp' as 'WhatsApp' | 'Admin',
    payment_method: 'COD' as 'COD' | 'UPI_WHATSAPP',
    shipping_fee: 0,
    variant_id: '',
    quantity: 1,
  });

  const load = () => {
    const qs = new URLSearchParams();
    if (statusFilter !== 'all') qs.set('status', statusFilter);
    if (sourceFilter !== 'all') qs.set('source', sourceFilter);
    if (searchQ) qs.set('q', searchQ);

    apiFetch<{ orders: any[] }>(`/api/admin/orders?${qs.toString()}`).then((r) => setOrders(r.orders));
    apiFetch<{ returns: any[] }>('/api/admin/returns').then((r) => setReturns(r.returns));
    apiFetch<{ variants: any[] }>('/api/admin/inventory').then((r) => {
      setVariants(r.variants);
      if (r.variants[0] && !manualOrder.variant_id) {
        setManualOrder((m) => ({ ...m, variant_id: r.variants[0].variant_id }));
      }
    });
  };

  useEffect(load, [statusFilter, sourceFilter]);

  const updateOrder = async (id: string, patch: any) => {
    await apiFetch(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    notify('Order updated');
    load();
    setSelectedOrder(null);
  };

  const submitManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ order_number: string }>('/api/admin/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...manualOrder,
          items: [{ variant_id: manualOrder.variant_id, quantity: Number(manualOrder.quantity) }],
        }),
      });
      notify(`Order ${res.order_number} created & stock deducted`);
      setCreateOpen(false);
      load();
    } catch (err: any) {
      notify(err.message || 'Could not create order', 'error');
    }
  };

  const reviewReturn = async (id: string, status: 'Approved' | 'Rejected', amount?: number) => {
    await apiFetch(`/api/admin/returns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, refund_amount: amount, refund_status: status === 'Approved' ? 'Processed' : undefined }),
    });
    notify(`Return ${status}`);
    load();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Orders, Fulfillment &amp; Returns</h1>
          <p className="text-xs text-gray-500 mt-0.5">Website, WhatsApp, and Admin-created orders with Proforma &amp; Final Invoice PDFs.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => downloadFileWithAuth('/api/admin/analytics/export', 'arora-garments-orders.csv', (m) => notify(m, 'error'))}
            className="px-3 py-2 border border-gray-300 bg-white rounded font-medium cursor-pointer"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create WhatsApp / Manual Order</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 text-xs">
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search Order ID, customer, mobile..."
          className="border border-gray-300 bg-white rounded px-3 py-2 w-64"
        />
        <button type="button" onClick={load} className="px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer">
          Search
        </button>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 bg-white rounded px-3 py-2">
          <option value="all">All Statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="border border-gray-300 bg-white rounded px-3 py-2">
          <option value="all">All Sources</option>
          <option value="Website">Website</option>
          <option value="WhatsApp">WhatsApp</option>
          <option value="Admin">Admin</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="border border-gray-200 bg-white rounded-md overflow-x-auto">
        <table className="w-full text-xs text-left tabular-nums">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <th className="p-3">Order ID</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Source</th>
              <th className="p-3">Payment &amp; Verification</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="p-3">
                  <span className="font-mono font-semibold text-gray-900">{o.order_number}</span>
                  {o.is_proforma === 1 && (
                    <span className="ml-1.5 inline-block px-1.5 py-0.5 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 rounded">
                      PROFORMA
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <p className="font-medium text-gray-900">{o.customer_name}</p>
                  <p className="text-gray-500">{o.customer_mobile}</p>
                </td>
                <td className="p-3 text-gray-700">{o.order_source}</td>
                <td className="p-3">
                  <div className="space-y-0.5">
                    <p className="font-medium text-gray-800">{paymentMethodLabel(o.payment_method)}</p>
                    <span className={`inline-block px-2 py-0.5 text-[10px] border rounded ${paymentStatusBadgeClass(o.payment_status)}`}>
                      {paymentStatusLabel(o.payment_status)}
                    </span>
                    {o.payment_reference && <p className="font-mono text-[10px] text-gray-500">UTR: {o.payment_reference}</p>}
                  </div>
                </td>
                <td className="p-3 font-medium text-gray-900">{o.order_status}</td>
                <td className="p-3 text-right font-semibold text-gray-900">{formatINR(o.grand_total)}</td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <button type="button" onClick={() => setSelectedOrder({ ...o })} className="underline font-medium text-gray-900 cursor-pointer">
                    Manage
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFileWithAuth(
                        `/api/orders/${o.id}/invoice.pdf`,
                        `${o.is_proforma ? 'proforma' : 'invoice'}-${o.order_number}.pdf`,
                        (m) => notify(m, 'error')
                      )
                    }
                    className="underline text-gray-600 cursor-pointer"
                  >
                    PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Return Requests */}
      {returns.length > 0 && (
        <div className="border border-gray-200 bg-white rounded-md p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Return &amp; Refund Requests</h2>
          <div className="divide-y divide-gray-100 text-xs">
            {returns.map((r) => (
              <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{r.order_number} · {r.customer_name} ({r.status})</p>
                  <p className="text-gray-500">Reason: {r.reason}</p>
                </div>
                {r.status === 'Pending' && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => reviewReturn(r.id, 'Approved', r.grand_total)} className="px-3 py-1.5 bg-gray-900 text-white rounded cursor-pointer">
                      Approve &amp; Record Refund
                    </button>
                    <button type="button" onClick={() => reviewReturn(r.id, 'Rejected')} className="px-3 py-1.5 border border-rose-700 text-rose-700 rounded cursor-pointer">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manage Order Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-md max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Order {selectedOrder.order_number}</h2>
                <p className="text-gray-500">
                  {selectedOrder.is_proforma === 1 ? 'Proforma Summary' : 'Retail Invoice'}: {selectedOrder.invoice_number} · {paymentMethodLabel(selectedOrder.payment_method)}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="underline text-gray-600 cursor-pointer">Close</button>
            </div>

            {(selectedOrder.payment_reference || selectedOrder.payment_claim_note) && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-1">
                <p className="font-semibold text-amber-950">Customer UPI Payment Claim</p>
                {selectedOrder.payment_reference && <p className="font-mono text-amber-900">UTR / Ref: {selectedOrder.payment_reference}</p>}
                {selectedOrder.payment_claim_note && <p className="text-amber-800">Note: {selectedOrder.payment_claim_note}</p>}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium mb-1">Order Status</label>
                <select
                  value={selectedOrder.order_status}
                  onChange={(e) => setSelectedOrder({ ...selectedOrder, order_status: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2.5 py-2"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Payment Status</label>
                <select
                  value={selectedOrder.payment_status}
                  onChange={(e) => setSelectedOrder({ ...selectedOrder, payment_status: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2.5 py-2"
                >
                  <option value="pending">Pending (COD)</option>
                  <option value="awaiting_payment">Awaiting UPI Payment</option>
                  <option value="payment_claimed">Payment Claimed (Needs Verification)</option>
                  <option value="under_verification">Under Manual Verification</option>
                  <option value="paid">Paid / Verified</option>
                  <option value="collected">Collected (COD)</option>
                  <option value="rejected">Payment Rejected</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Courier Partner</label>
                <input
                  value={selectedOrder.courier_partner || ''}
                  onChange={(e) => setSelectedOrder({ ...selectedOrder, courier_partner: e.target.value })}
                  placeholder="e.g. Delhivery / Local Rider"
                  className="w-full border border-gray-300 rounded px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Tracking Number</label>
                <input
                  value={selectedOrder.tracking_number || ''}
                  onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_number: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2.5 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Tracking URL</label>
                <input
                  value={selectedOrder.tracking_url || ''}
                  onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_url: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  value={selectedOrder.expected_delivery_date || ''}
                  onChange={(e) => setSelectedOrder({ ...selectedOrder, expected_delivery_date: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2.5 py-2"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <p className="font-semibold mb-2">Ordered Items</p>
              {selectedOrder.items?.map((it: any) => (
                <div key={it.id} className="flex justify-between py-1">
                  <span>{it.product_title} ({it.size}/{it.color}) × {it.quantity}</span>
                  <span className="tabular-nums font-medium">{formatINR(it.line_total)}</span>
                </div>
              ))}
              <div className="mt-3 pt-2.5 border-t border-gray-100 space-y-1 text-gray-600 tabular-nums">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatINR(selectedOrder.subtotal)}</span>
                </div>
                {Number(selectedOrder.discount_amount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span>-{formatINR(selectedOrder.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{Number(selectedOrder.shipping_fee || 0) === 0 ? 'Free' : formatINR(selectedOrder.shipping_fee)}</span>
                </div>
                {Number(selectedOrder.tax_amount || 0) > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>Taxable Value</span>
                      <span>{formatINR(selectedOrder.taxable_amount || 0)}</span>
                    </div>
                    {Number(selectedOrder.igst_amount || 0) > 0 ? (
                      <div className="flex justify-between">
                        <span>IGST</span>
                        <span>{formatINR(selectedOrder.igst_amount)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span>CGST</span>
                          <span>{formatINR(selectedOrder.cgst_amount || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>SGST</span>
                          <span>{formatINR(selectedOrder.sgst_amount || 0)}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
                <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-100">
                  <span>Grand Total</span>
                  <span>{formatINR(selectedOrder.grand_total)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadFileWithAuth(
                      `/api/orders/${selectedOrder.id}/invoice.pdf`,
                      `${selectedOrder.is_proforma ? 'proforma' : 'invoice'}-${selectedOrder.order_number}.pdf`,
                      (m) => notify(m, 'error')
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>{selectedOrder.is_proforma ? 'Proforma PDF' : 'Invoice PDF'}</span>
                </button>
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded cursor-pointer">
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <a
                  href={`https://wa.me/${selectedOrder.customer_mobile.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Namaste ${selectedOrder.customer_name}, your Arora Garments order ${selectedOrder.order_number} (Invoice ${selectedOrder.invoice_number}) is ${selectedOrder.order_status}. Total: ₹${selectedOrder.grand_total}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateOrder(selectedOrder.id, {
                    order_status: selectedOrder.order_status,
                    payment_status: selectedOrder.payment_status,
                    courier_partner: selectedOrder.courier_partner,
                    tracking_number: selectedOrder.tracking_number,
                    tracking_url: selectedOrder.tracking_url,
                    expected_delivery_date: selectedOrder.expected_delivery_date,
                  })
                }
                className="px-5 py-2.5 bg-gray-900 text-white rounded font-medium cursor-pointer"
              >
                Save Order Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Order Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={submitManualOrder} className="bg-white border border-gray-200 rounded-md max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Create Confirmed WhatsApp / Manual Order</h2>
              <button type="button" onClick={() => setCreateOpen(false)} className="underline cursor-pointer">Cancel</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="Customer Name" value={manualOrder.customer_name} onChange={(e) => setManualOrder({ ...manualOrder, customer_name: e.target.value })} className="border border-gray-300 rounded px-3 py-2" />
              <input required placeholder="Mobile Number" value={manualOrder.customer_mobile} onChange={(e) => setManualOrder({ ...manualOrder, customer_mobile: e.target.value })} className="border border-gray-300 rounded px-3 py-2" />
              <input required placeholder="Address Line" value={manualOrder.address_line} onChange={(e) => setManualOrder({ ...manualOrder, address_line: e.target.value })} className="col-span-2 border border-gray-300 rounded px-3 py-2" />
              <input required placeholder="City" value={manualOrder.city} onChange={(e) => setManualOrder({ ...manualOrder, city: e.target.value })} className="border border-gray-300 rounded px-3 py-2" />
              <input required placeholder="PIN Code" maxLength={6} value={manualOrder.pincode} onChange={(e) => setManualOrder({ ...manualOrder, pincode: e.target.value })} className="border border-gray-300 rounded px-3 py-2" />
              <select value={manualOrder.order_source} onChange={(e) => setManualOrder({ ...manualOrder, order_source: e.target.value as any })} className="border border-gray-300 rounded px-3 py-2">
                <option value="WhatsApp">WhatsApp Confirmed</option>
                <option value="Admin">Admin / In-Store</option>
              </select>
              <select value={manualOrder.payment_method} onChange={(e) => setManualOrder({ ...manualOrder, payment_method: e.target.value as any })} className="border border-gray-300 rounded px-3 py-2">
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="UPI_WHATSAPP">UPI / Pay via WhatsApp</option>
              </select>
              <select value={manualOrder.variant_id} onChange={(e) => setManualOrder({ ...manualOrder, variant_id: e.target.value })} className="col-span-2 border border-gray-300 rounded px-3 py-2">
                {variants.map((v) => (
                  <option key={v.variant_id} value={v.variant_id}>
                    {v.title} — {v.sku} ({v.size}/{v.color}) · {v.quantity_available} in stock
                  </option>
                ))}
              </select>
              <input type="number" min={1} placeholder="Quantity" value={manualOrder.quantity} onChange={(e) => setManualOrder({ ...manualOrder, quantity: Number(e.target.value) })} className="border border-gray-300 rounded px-3 py-2" />
              <input type="number" min={0} placeholder="Courier Fee (INR)" value={manualOrder.shipping_fee} onChange={(e) => setManualOrder({ ...manualOrder, shipping_fee: Number(e.target.value) })} className="border border-gray-300 rounded px-3 py-2" />
            </div>
            <button type="submit" className="w-full py-2.5 bg-gray-900 text-white rounded font-medium cursor-pointer">
              Create Order &amp; Deduct Stock
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminPaymentsPage() {
  const { notify } = useStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [activePayment, setActivePayment] = useState<any | null>(null);
  const [refInput, setRefInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [autoConfirmOrder, setAutoConfirmOrder] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    const qs = new URLSearchParams();
    if (statusFilter !== 'all') qs.set('status', statusFilter);
    if (methodFilter !== 'all') qs.set('method', methodFilter);
    apiFetch<{ payments: any[] }>(`/api/admin/payments?${qs.toString()}`).then((r) => setPayments(r.payments));
  };

  useEffect(load, [statusFilter, methodFilter]);

  const openModal = (p: any) => {
    setActivePayment(p);
    setRefInput(p.payment_reference || '');
    setNoteInput('');
    setAutoConfirmOrder(true);
  };

  const verifyPayment = async (
    nextStatus: 'under_verification' | 'paid' | 'rejected' | 'refunded' | 'collected'
  ) => {
    if (!activePayment) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/payments/${activePayment.id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          payment_status: nextStatus,
          payment_reference: refInput.trim() || undefined,
          note: noteInput.trim() || undefined,
          auto_confirm_order: autoConfirmOrder,
        }),
      });
      notify(`Payment marked as "${paymentStatusLabel(nextStatus)}"`);
      setActivePayment(null);
      load();
    } catch (err: any) {
      notify(err.message || 'Verification update failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">UPI / WhatsApp Payment Verification Queue</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Verify UPI UTR references and WhatsApp payment screenshots manually before marking orders Paid and converting Proforma summaries to final Retail Invoices.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 bg-white rounded px-3 py-2">
          <option value="all">All Payment Statuses</option>
          <option value="payment_claimed">Payment Claimed (Priority)</option>
          <option value="under_verification">Under Verification</option>
          <option value="awaiting_payment">Awaiting UPI Payment</option>
          <option value="paid">Paid / Verified</option>
          <option value="rejected">Rejected</option>
          <option value="pending">Pending (COD)</option>
          <option value="collected">Collected (COD)</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="border border-gray-300 bg-white rounded px-3 py-2">
          <option value="all">All Methods</option>
          <option value="UPI_WHATSAPP">UPI / Pay via WhatsApp</option>
          <option value="COD">Cash on Delivery (COD)</option>
          <option value="WHATSAPP_MANUAL">WhatsApp Order Enquiry</option>
        </select>
      </div>

      <div className="border border-gray-200 bg-white rounded-md overflow-x-auto">
        <table className="w-full text-xs text-left tabular-nums">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <th className="p-3">Order &amp; Date</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Method &amp; UTR Claim</th>
              <th className="p-3">Status</th>
              <th className="p-3">Verified By</th>
              <th className="p-3 text-right">Amount</th>
              <th className="p-3 text-right">Verify</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No payment records match the selected filters.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <p className="font-mono font-semibold text-gray-900">{p.order_number}</p>
                    <p className="text-[11px] text-gray-500">{new Date(p.created_at).toLocaleDateString('en-IN')}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-gray-900">{p.customer_name}</p>
                    <p className="text-gray-500">{p.customer_mobile}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-gray-800">{paymentMethodLabel(p.payment_method)}</p>
                    {p.payment_reference ? (
                      <p className="font-mono text-[11px] text-gray-700">UTR: {p.payment_reference}</p>
                    ) : (
                      <p className="text-[11px] text-gray-400">No UTR submitted yet</p>
                    )}
                    {p.payment_claim_note && <p className="text-[11px] text-gray-500 truncate max-w-[200px]">{p.payment_claim_note}</p>}
                  </td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 text-[10px] border rounded ${paymentStatusBadgeClass(p.payment_status)}`}>
                      {paymentStatusLabel(p.payment_status)}
                    </span>
                    {p.is_proforma === 1 && (
                      <p className="text-[10px] text-amber-700 mt-0.5">Proforma Only</p>
                    )}
                  </td>
                  <td className="p-3 text-gray-600">
                    {p.payment_verified_by ? (
                      <>
                        <p className="font-medium text-gray-900">{p.payment_verified_by}</p>
                        {p.payment_verified_at && (
                          <p className="text-[10px] text-gray-400">
                            {new Date(p.payment_verified_at).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3 text-right font-semibold text-gray-900">{formatINR(p.grand_total)}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => openModal(p)}
                      className="px-3 py-1.5 bg-gray-900 text-white rounded text-[11px] font-medium cursor-pointer hover:bg-gray-800"
                    >
                      Verify / Update
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activePayment && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-md max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Verify Payment · {activePayment.order_number}</h2>
                <p className="text-gray-500">
                  {activePayment.customer_name} ({activePayment.customer_mobile}) · Amount: <strong>{formatINR(activePayment.grand_total)}</strong>
                </p>
              </div>
              <button type="button" onClick={() => setActivePayment(null)} className="underline text-gray-500 cursor-pointer">
                Close
              </button>
            </div>

            {activePayment.payment_claim_note && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                <p className="font-semibold text-amber-950">Customer Claim Note</p>
                <p className="text-amber-900 mt-0.5">{activePayment.payment_claim_note}</p>
              </div>
            )}

            <div>
              <label className="block font-medium text-gray-700 mb-1">UTR / UPI Transaction Reference Number</label>
              <input
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="e.g. 428910384712"
                className="w-full border border-gray-300 rounded px-3 py-2 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-gray-700 mb-1">Verification / Audit Note</label>
              <input
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Checked in GPay / Paytm merchant app or WhatsApp screenshot"
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoConfirmOrder}
                onChange={(e) => setAutoConfirmOrder(e.target.checked)}
              />
              <span>Automatically confirm order (&quot;Pending Confirmation&quot; → &quot;Confirmed&quot;) when marked Paid</span>
            </label>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => verifyPayment('under_verification')}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 border border-amber-300 bg-amber-50 text-amber-900 rounded font-medium cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Mark Under Verification</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => verifyPayment('paid')}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 bg-emerald-700 text-white rounded font-medium cursor-pointer hover:bg-emerald-800"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verify &amp; Mark Paid</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => verifyPayment('rejected')}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 border border-rose-300 bg-rose-50 text-rose-800 rounded font-medium cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject Payment</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => verifyPayment(activePayment.payment_method === 'COD' ? 'collected' : 'refunded')}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 border border-gray-300 bg-white text-gray-800 rounded font-medium cursor-pointer"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                <span>{activePayment.payment_method === 'COD' ? 'Mark COD Collected' : 'Mark Refunded'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
