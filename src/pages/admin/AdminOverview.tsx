import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertCircle, Download, FileClock, IndianRupee, MessageSquare, Star } from 'lucide-react';
import {
  apiFetch,
  DEPARTMENT_LABELS,
  formatINR,
  getAuthToken,
  paymentMethodLabel,
  paymentStatusBadgeClass,
  paymentStatusLabel,
} from '../../lib/api';

async function downloadCsvWithAuth(url: string, filename: string) {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { credentials: 'include', headers });
  if (!res.ok) return;
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

function formatAxisInr(value: number) {
  if (!value) return '₹0';
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `₹${Math.round(value)}`;
}

function RevenueTooltip({ active, payload, metric }: any) {
  if (!active || !payload || !payload.length) return null;
  const pt = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-md px-3 py-2 text-xs space-y-1">
      <p className="font-semibold text-gray-900">{pt.label || pt.day}</p>
      <p className="text-gray-700 tabular-nums">
        Revenue: <span className="font-semibold text-gray-900">{formatINR(pt.revenue || 0)}</span>
      </p>
      <p className="text-gray-600 tabular-nums">
        Orders: <span className="font-semibold text-gray-900">{pt.orders || 0}</span>
      </p>
      {metric === 'orders' && (
        <p className="text-[10px] text-gray-400">{pt.day}</p>
      )}
    </div>
  );
}

export function AdminOverview() {
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'orders'>('revenue');

  const load = (customStart?: string, customEnd?: string) => {
    setLoading(true);
    const s = customStart ?? startDate;
    const e = customEnd ?? endDate;
    const qs = s && e ? `?startDate=${s}&endDate=${e}` : '';
    apiFetch(`/api/admin/overview${qs}`)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return <div className="text-sm text-gray-600">Loading live database metrics...</div>;
  }

  const k = data.kpis;
  const salesSeries = data.sales_by_day || [];
  const hasAnySalesInSeries = salesSeries.some((d: any) => Number(d.revenue) > 0 || Number(d.orders) > 0);
  const funnelMap = new Map<string, number>((data.analytics_funnel || []).map((f: any) => [f.event_type, f.count]));
  const reviewSum = data.review_summary || { total_reviews: 0, average_rating: 0, approved_reviews: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Executive Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Real-time database totals · INR (₹) · Asia/Kolkata</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-300 bg-white rounded px-2.5 py-1.5" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 bg-white rounded px-2.5 py-1.5" />
          <button type="button" onClick={() => load()} className="px-3 py-1.5 bg-gray-900 text-white rounded font-medium cursor-pointer">
            Filter
          </button>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                load('', '');
              }}
              className="px-2.5 py-1.5 border border-gray-300 bg-white rounded cursor-pointer hover:bg-gray-50"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => downloadCsvWithAuth('/api/admin/analytics/export', 'arora-garments-sales-report.csv')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 bg-white rounded font-medium cursor-pointer hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Action Alerts */}
      {(Number(k.pending_upi_verifications || 0) > 0 || Number(k.draft_products || 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Number(k.pending_upi_verifications || 0) > 0 && (
            <Link
              to="/admin/payments"
              className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <IndianRupee className="w-5 h-5 text-amber-700 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-950">
                    {k.pending_upi_verifications} UPI / WhatsApp Order(s) Awaiting Manual Verification
                  </p>
                  <p className="text-[11px] text-amber-800">Verify UTR receipts before issuing final invoice or dispatching</p>
                </div>
              </div>
              <span className="text-xs font-semibold underline text-amber-900">Review Queue →</span>
            </Link>
          )}
          {Number(k.draft_products || 0) > 0 && (
            <Link
              to="/admin/products?filter=drafts"
              className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileClock className="w-5 h-5 text-slate-700 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-900">
                    {k.draft_products} Draft Starter Product(s) Pending Review
                  </p>
                  <p className="text-[11px] text-slate-600">Hidden from live storefront until prices, photos &amp; stock are approved</p>
                </div>
              </div>
              <span className="text-xs font-semibold underline text-slate-900">Review Drafts →</span>
            </Link>
          )}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Total Revenue', formatINR(k.total_revenue), `Net Sales: ${formatINR(k.net_sales)}`],
          ["Today's Sales", formatINR(k.today_sales), `7d: ${formatINR(k.weekly_sales)}`],
          ['Monthly Sales (30d)', formatINR(k.monthly_sales), `AOV: ${formatINR(k.average_order_value)}`],
          ['Total Orders', String(k.total_orders), `COD: ${k.cod_orders || 0} · UPI/Online: ${k.online_orders || 0}`],
          ['Pending / Processing', `${k.pending_orders || 0} / ${k.processing_orders || 0}`, `UPI Pending: ${k.pending_upi_verifications || 0}`],
          ['Shipped / Delivered', `${k.shipped_orders || 0} / ${k.delivered_orders || 0}`, `Cancelled: ${k.cancelled_orders || 0}`],
          ['Catalog Products', String(k.total_products), `Drafts: ${k.draft_products || 0} · Low stock: ${data.low_stock.length}`],
          ['Registered Customers', String(k.total_customers), `Reviews: ${reviewSum.total_reviews} (${reviewSum.average_rating || '—'}★)`],
        ].map(([label, val, sub]) => (
          <div key={label} className="border border-gray-200 bg-white rounded-md p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{label}</p>
            <p className="mt-1.5 text-xl sm:text-2xl font-semibold tabular-nums text-gray-900">{val}</p>
            <p className="mt-1 text-[11px] text-gray-500 tabular-nums">{sub}</p>
          </div>
        ))}
      </div>

      {/* Sales Chart & Event Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 min-w-0 border border-gray-200 bg-white rounded-md p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Daily {chartMetric === 'revenue' ? 'Revenue' : 'Order Volume'} ({salesSeries.length}-Day Window)
              </h2>
              <p className="text-[11px] text-gray-500">
                {hasAnySalesInSeries
                  ? 'Continuous daily timeline excluding cancelled & refunded orders'
                  : 'No orders in this window yet — daily baseline shown'}
              </p>
            </div>
            <div className="inline-flex rounded border border-gray-200 p-0.5 bg-gray-50 text-xs">
              <button
                type="button"
                onClick={() => setChartMetric('revenue')}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                  chartMetric === 'revenue' ? 'bg-gray-900 text-white' : 'text-gray-600'
                }`}
              >
                Revenue (₹)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('orders')}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                  chartMetric === 'orders' ? 'bg-gray-900 text-white' : 'text-gray-600'
                }`}
              >
                Orders
              </button>
            </div>
          </div>

          <div className="w-full min-w-0" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height={260} minWidth={0}>
              <AreaChart data={salesSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="agSalesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  minTickGap={22}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  width={56}
                  allowDecimals={chartMetric === 'revenue'}
                  tickFormatter={(v) => (chartMetric === 'revenue' ? formatAxisInr(Number(v)) : String(v))}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<RevenueTooltip metric={chartMetric} />} />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="#111827"
                  strokeWidth={2}
                  fill="url(#agSalesGrad)"
                  activeDot={{ r: 5, fill: '#111827' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 min-w-0 border border-gray-200 bg-white rounded-md p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Storefront Event Funnel</h2>
            <p className="text-[11px] text-gray-500">Session conversion tracking</p>
          </div>
          <div className="space-y-2.5 text-xs tabular-nums">
            {[
              ['Product Views', funnelMap.get('product_view') || 0],
              ['Add to Cart Events', funnelMap.get('add_to_cart') || 0],
              ['Checkout Initiated', funnelMap.get('checkout_initiated') || 0],
              ['Completed Orders', funnelMap.get('order_completed') || 0],
            ].map(([lbl, count]) => (
              <div key={String(lbl)} className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">{lbl}</span>
                <span className="font-semibold text-gray-900">{count}</span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Revenue by Department</h3>
            {data.department_revenue.length === 0 ? (
              <p className="text-xs text-gray-500">No department sales yet.</p>
            ) : (
              <div className="space-y-1.5 text-xs tabular-nums">
                {data.department_revenue.map((d: any) => (
                  <div key={d.department} className="flex justify-between">
                    <span className="text-gray-700">{DEPARTMENT_LABELS[d.department] || d.department}</span>
                    <span className="font-medium text-gray-900">{formatINR(d.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock, Recent Orders & Customer Reviews Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 min-w-0 border border-gray-200 bg-white rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Low-Stock Variant Alerts</h2>
            <Link to="/admin/inventory" className="text-xs underline text-gray-600">Manage Stock</Link>
          </div>
          {data.low_stock.length === 0 ? (
            <p className="text-xs text-gray-500">All active variants are above low-stock thresholds.</p>
          ) : (
            <div className="divide-y divide-gray-100 text-xs">
              {data.low_stock.slice(0, 6).map((v: any) => (
                <div key={v.variant_id} className="py-2.5 flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{v.title}</p>
                    <p className="text-gray-500 font-mono">{v.sku} · {v.size} / {v.color}</p>
                  </div>
                  <span className="font-semibold tabular-nums text-rose-700 inline-flex items-center gap-1 shrink-0">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {v.quantity_available} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 min-w-0 border border-gray-200 bg-white rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Recent Orders</h2>
            <Link to="/admin/orders" className="text-xs underline text-gray-600">All Orders</Link>
          </div>
          {data.recent_orders.length === 0 ? (
            <p className="text-xs text-gray-500">No orders placed yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left tabular-nums">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2">Order</th>
                    <th className="py-2">Customer</th>
                    <th className="py-2">Payment</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.recent_orders.slice(0, 6).map((o: any) => (
                    <tr key={o.id}>
                      <td className="py-2.5 font-mono font-medium text-gray-900">{o.order_number}</td>
                      <td className="py-2.5 text-gray-800">{o.customer_name}</td>
                      <td className="py-2.5">
                        <span className={`inline-block px-2 py-0.5 text-[10px] border rounded ${paymentStatusBadgeClass(o.payment_status)}`}>
                          {paymentMethodLabel(o.payment_method)} · {paymentStatusLabel(o.payment_status)}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-gray-900">{formatINR(o.grand_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 min-w-0 border border-gray-200 bg-white rounded-md p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              <span>Latest Reviews</span>
            </h2>
            <Link to="/admin/reviews" className="text-xs underline text-gray-600">Manage</Link>
          </div>
          {(!data.recent_reviews || data.recent_reviews.length === 0) ? (
            <div className="py-4 text-xs text-gray-500 space-y-2">
              <p>No customer product reviews yet.</p>
              <Link to="/admin/reviews" className="inline-block underline text-gray-900 font-medium">
                Open Reviews Panel →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 text-xs">
              {data.recent_reviews.map((r: any) => (
                <div key={r.id} className="py-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900 truncate">{r.product_title}</span>
                    <span className="inline-flex items-center gap-0.5 font-semibold shrink-0">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      {r.rating}
                    </span>
                  </div>
                  <p className="text-gray-600 line-clamp-2">{r.comment}</p>
                  <p className="text-[10px] text-gray-400">by {r.reviewer_name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [velocityMetric, setVelocityMetric] = useState<'revenue' | 'orders'>('revenue');

  const load = (customStart?: string, customEnd?: string) => {
    setLoading(true);
    const s = customStart ?? startDate;
    const e = customEnd ?? endDate;
    const qs = s && e ? `?startDate=${s}&endDate=${e}` : '';
    apiFetch(`/api/admin/overview${qs}`)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !data) {
    return <div className="text-sm text-gray-600">Loading store analytics...</div>;
  }

  const k = data.kpis;
  const salesSeries = data.sales_by_day || [];
  const funnelMap = new Map<string, number>((data.analytics_funnel || []).map((f: any) => [f.event_type, f.count]));

  const deptChartData = (data.department_revenue || []).map((d: any) => ({
    name: DEPARTMENT_LABELS[d.department] || d.department,
    revenue: Number(d.revenue || 0),
    units: Number(d.units || 0),
  }));

  const funnelChartData = [
    { stage: 'Views', count: Number(funnelMap.get('product_view') || 0) },
    { stage: 'Add to Cart', count: Number(funnelMap.get('add_to_cart') || 0) },
    { stage: 'Checkout', count: Number(funnelMap.get('checkout_initiated') || 0) },
    { stage: 'Orders', count: Number(funnelMap.get('order_completed') || 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sales &amp; Conversion Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Order revenue velocity, department share, best sellers, and conversion funnel graphs</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-300 bg-white rounded px-2.5 py-1.5" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 bg-white rounded px-2.5 py-1.5" />
          <button type="button" onClick={() => load()} className="px-3 py-1.5 bg-gray-900 text-white rounded font-medium cursor-pointer">
            Apply Range
          </button>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                load('', '');
              }}
              className="px-2.5 py-1.5 border border-gray-300 bg-white rounded cursor-pointer hover:bg-gray-50"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={() => downloadCsvWithAuth('/api/admin/analytics/export', 'arora-garments-analytics.csv')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 bg-white rounded font-medium cursor-pointer hover:bg-gray-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Full CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Gross Sales', formatINR(k.gross_sales)],
          ['Net Revenue', formatINR(k.net_sales)],
          ['Average Order Value', formatINR(k.average_order_value)],
          ['COD vs UPI Orders', `${k.cod_orders || 0} COD / ${k.online_orders || 0} UPI`],
        ].map(([lbl, val]) => (
          <div key={lbl} className="border border-gray-200 bg-white rounded-md p-4">
            <p className="text-[11px] uppercase tracking-wider text-gray-500">{lbl}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{val}</p>
          </div>
        ))}
      </div>

      {/* Primary Sales Velocity BarChart + Best Sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 min-w-0 border border-gray-200 bg-white rounded-md p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              {salesSeries.length}-Day Sales Velocity ({velocityMetric === 'revenue' ? '₹ Revenue' : 'Orders'})
            </h2>
            <div className="inline-flex rounded border border-gray-200 p-0.5 bg-gray-50 text-xs">
              <button
                type="button"
                onClick={() => setVelocityMetric('revenue')}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                  velocityMetric === 'revenue' ? 'bg-gray-900 text-white' : 'text-gray-600'
                }`}
              >
                Revenue
              </button>
              <button
                type="button"
                onClick={() => setVelocityMetric('orders')}
                className={`px-2.5 py-1 rounded font-medium cursor-pointer ${
                  velocityMetric === 'orders' ? 'bg-gray-900 text-white' : 'text-gray-600'
                }`}
              >
                Orders
              </button>
            </div>
          </div>

          <div className="w-full min-w-0" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height={260} minWidth={0}>
              <BarChart data={salesSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} minTickGap={22} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  width={56}
                  allowDecimals={velocityMetric === 'revenue'}
                  tickFormatter={(v) => (velocityMetric === 'revenue' ? formatAxisInr(Number(v)) : String(v))}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<RevenueTooltip metric={velocityMetric} />} />
                <Bar dataKey={velocityMetric} fill="#111827" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 min-w-0 border border-gray-200 bg-white rounded-md p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Best-Selling Garments &amp; Footwear</h2>
          {data.best_selling?.length === 0 ? (
            <p className="text-xs text-gray-500">No confirmed product sales recorded yet.</p>
          ) : (
            <div className="divide-y divide-gray-100 text-xs tabular-nums">
              {data.best_selling.map((item: any) => (
                <div key={item.product_id || item.product_title} className="py-2.5 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.product_title}</p>
                    <p className="text-gray-500">{item.units_sold} unit(s) sold</p>
                  </div>
                  <span className="font-semibold text-gray-900 shrink-0">{formatINR(item.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Department Revenue Graph & Customer Funnel Graph */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="min-w-0 border border-gray-200 bg-white rounded-md p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Department Revenue Share</h2>
          {deptChartData.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">No department revenue data yet.</p>
          ) : (
            <>
              <div className="w-full min-w-0" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height={220} minWidth={0}>
                  <BarChart data={deptChartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4B5563' }} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      width={52}
                      tickFormatter={(v) => formatAxisInr(Number(v))}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatINR(Number(val)), 'Revenue']}
                      contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#E5E7EB' }}
                    />
                    <Bar dataKey="revenue" fill="#B45309" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="divide-y divide-gray-100 text-xs tabular-nums">
                {data.department_revenue.map((d: any) => (
                  <div key={d.department} className="py-2 flex justify-between">
                    <span className="text-gray-700">{DEPARTMENT_LABELS[d.department] || d.department} ({d.units} units)</span>
                    <span className="font-semibold text-gray-900">{formatINR(d.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="min-w-0 border border-gray-200 bg-white rounded-md p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Customer Funnel Telemetry</h2>
          <div className="w-full min-w-0" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height={220} minWidth={0}>
              <BarChart data={funnelChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#4B5563' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${val} event(s)`, 'Count']}
                  contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#E5E7EB' }}
                />
                <Bar dataKey="count" fill="#1F2937" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="divide-y divide-gray-100 text-xs tabular-nums">
            {funnelChartData.map((row) => (
              <div key={row.stage} className="py-2 flex justify-between">
                <span className="text-gray-700">{row.stage}</span>
                <span className="font-semibold text-gray-900">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
