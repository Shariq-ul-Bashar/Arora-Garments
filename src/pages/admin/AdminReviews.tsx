import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, MessageSquare, Search, Star, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../../context/StoreContext';
import { apiFetch } from '../../lib/api';
import type { AdminReviewRecord } from '../../types';

interface ReviewStats {
  total: number;
  approved: number;
  hidden: number;
  average_rating: number;
  distribution: Array<{ star: string; rating: number; count: number }>;
}

export function AdminReviewsPage() {
  const { notify } = useStore();
  const [reviews, setReviews] = useState<AdminReviewRecord[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'hidden'>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [searchQ, setSearchQ] = useState('');
  const [loading, setLoading] = useState(true);

  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (statusFilter !== 'all') qs.set('status', statusFilter);
    if (ratingFilter !== 'all') qs.set('rating', ratingFilter);
    if (searchQ.trim()) qs.set('q', searchQ.trim());

    apiFetch<{ reviews: AdminReviewRecord[]; stats: ReviewStats }>(`/api/admin/reviews?${qs.toString()}`)
      .then((res) => {
        setReviews(res.reviews);
        setStats(res.stats);
      })
      .catch((err: any) => notify(err.message || 'Could not load reviews', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [statusFilter, ratingFilter]);

  const toggleApproval = async (rev: AdminReviewRecord) => {
    try {
      await apiFetch(`/api/admin/reviews/${rev.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_approved: !rev.is_approved }),
      });
      notify(rev.is_approved ? 'Review hidden from storefront' : 'Review approved & published live');
      load();
    } catch (err: any) {
      notify(err.message || 'Update failed', 'error');
    }
  };

  const submitReply = async (id: string) => {
    try {
      await apiFetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ admin_reply: replyDraft.trim() || null }),
      });
      notify(replyDraft.trim() ? 'Store reply saved' : 'Store reply cleared');
      setReplyingId(null);
      setReplyDraft('');
      load();
    } catch (err: any) {
      notify(err.message || 'Could not save reply', 'error');
    }
  };

  const deleteReview = async (id: string) => {
    try {
      await apiFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
      notify('Review deleted');
      setConfirmDeleteId(null);
      load();
    } catch (err: any) {
      notify(err.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Customer Reviews &amp; Ratings</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Moderate customer feedback, view star rating distribution, and post official Arora Garments store responses.
        </p>
      </div>

      {/* KPI Cards + Rating Distribution Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 grid grid-cols-2 gap-4">
          {[
            ['Total Reviews', String(stats?.total ?? 0), 'All submitted product reviews'],
            ['Average Rating', stats?.total ? `${stats.average_rating.toFixed(1)} / 5` : '—', 'Across customer feedback'],
            ['Published Live', String(stats?.approved ?? 0), 'Visible on product pages'],
            ['Hidden / Moderated', String(stats?.hidden ?? 0), 'Unpublished from storefront'],
          ].map(([label, val, sub]) => (
            <div key={label} className="border border-gray-200 bg-white rounded-md p-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">{label}</p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-gray-900">{val}</p>
              <p className="mt-1 text-[11px] text-gray-500">{sub}</p>
            </div>
          ))}
        </div>

        <div className="lg:col-span-7 min-w-0 border border-gray-200 bg-white rounded-md p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Star Rating Distribution</h2>
          <div className="w-full min-w-0" style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height={190} minWidth={0}>
              <BarChart data={stats?.distribution || []} margin={{ top: 6, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis dataKey="star" tick={{ fontSize: 11, fill: '#4B5563' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#4B5563' }} />
                <Tooltip
                  formatter={(value: any) => [`${value} review(s)`, 'Count']}
                  contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: '#E5E7EB' }}
                />
                <Bar dataKey="count" fill="#111827" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 text-xs bg-white border border-gray-200 rounded-md p-3">
        <div className="flex items-center border border-gray-300 rounded px-2.5 py-1.5 flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Search by product, reviewer, or comment..."
            className="w-full bg-transparent focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer"
        >
          Search
        </button>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="border border-gray-300 bg-white rounded px-3 py-2"
        >
          <option value="all">All Statuses</option>
          <option value="approved">Published Live</option>
          <option value="hidden">Hidden</option>
        </select>
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value)}
          className="border border-gray-300 bg-white rounded px-3 py-2"
        >
          <option value="all">All Star Ratings</option>
          <option value="5">5 Stars</option>
          <option value="4">4 Stars</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star</option>
        </select>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {loading ? (
          <div className="border border-gray-200 bg-white rounded-md p-8 text-center text-xs text-gray-500">
            Loading customer reviews...
          </div>
        ) : reviews.length === 0 ? (
          <div className="border border-gray-200 bg-white rounded-md p-10 text-center space-y-2">
            <MessageSquare className="w-7 h-7 mx-auto text-gray-400" />
            <p className="text-sm font-medium text-gray-900">No customer reviews match these filters</p>
            <p className="text-xs text-gray-500">
              Reviews submitted by signed-in shoppers on product pages will appear here for moderation and store replies.
            </p>
          </div>
        ) : (
          reviews.map((rev) => (
            <div key={rev.id} className="border border-gray-200 bg-white rounded-md p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  {rev.product_image ? (
                    <img
                      src={rev.product_image}
                      alt={rev.product_title}
                      className="w-11 h-14 object-cover rounded border border-gray-200 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-14 bg-gray-100 rounded border border-gray-200 shrink-0" />
                  )}
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/product/${rev.product_slug}`}
                        target="_blank"
                        className="font-semibold text-sm text-gray-900 hover:underline truncate"
                      >
                        {rev.product_title}
                      </Link>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                          rev.is_approved
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {rev.is_approved ? 'Published' : 'Hidden'}
                      </span>
                      {Boolean(rev.is_verified_purchase) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Verified Buyer
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-gray-600">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`w-3.5 h-3.5 ${n <= rev.rating ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                      <span className="font-medium text-gray-900">{rev.reviewer_name}</span>
                      {(rev.customer_phone || rev.customer_email) && (
                        <span className="text-gray-400">
                          · {rev.customer_phone || rev.customer_email}
                        </span>
                      )}
                      <span className="text-gray-400">
                        · {new Date(rev.created_at).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleApproval(rev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    {rev.is_approved ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{rev.is_approved ? 'Hide' : 'Publish'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingId(rev.id);
                      setReplyDraft(rev.admin_reply || '');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-900 text-gray-900 rounded font-medium hover:bg-gray-50 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{rev.admin_reply ? 'Edit Reply' : 'Reply'}</span>
                  </button>
                  {confirmDeleteId === rev.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => deleteReview(rev.id)}
                        className="px-2.5 py-1.5 bg-rose-700 text-white rounded font-medium cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1.5 border border-gray-300 rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(rev.id)}
                      className="p-1.5 border border-rose-200 text-rose-700 rounded hover:bg-rose-50 cursor-pointer"
                      title="Delete review"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-800 leading-relaxed pl-0 sm:pl-14">{rev.comment}</p>

              {rev.admin_reply && replyingId !== rev.id && (
                <div className="ml-0 sm:ml-14 p-3 bg-gray-50 border-l-2 border-gray-900 rounded-r space-y-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Store Reply (Arora Garments)
                  </p>
                  <p className="text-xs text-gray-800">{rev.admin_reply}</p>
                </div>
              )}

              {replyingId === rev.id && (
                <div className="ml-0 sm:ml-14 p-3 bg-gray-50 border border-gray-200 rounded space-y-2">
                  <label className="block font-medium text-gray-700">Official Store Response</label>
                  <textarea
                    rows={2}
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Thank the customer or address sizing/delivery feedback..."
                    className="w-full border border-gray-300 bg-white rounded p-2"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingId(null);
                        setReplyDraft('');
                      }}
                      className="px-3 py-1.5 border border-gray-300 bg-white rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => submitReply(rev.id)}
                      className="px-4 py-1.5 bg-gray-900 text-white rounded font-medium cursor-pointer"
                    >
                      Save Store Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
