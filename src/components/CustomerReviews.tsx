import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Edit3, MessageSquare, Star } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import type { ProductReview } from '../types';

interface CustomerReviewsProps {
  productId: string;
  productTitle: string;
  reviews: ProductReview[];
  onReviewSubmitted: () => Promise<void> | void;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

export function CustomerReviews({
  productId,
  productTitle,
  reviews,
  onReviewSubmitted,
}: CustomerReviewsProps) {
  const { user, notify } = useStore();

  const existingUserReview = useMemo(
    () => (user ? reviews.find((r) => r.user_id && r.user_id === user.id) || null : null),
    [reviews, user]
  );

  const [editingExisting, setEditingExisting] = useState(false);
  const [rating, setRating] = useState<number>(existingUserReview?.rating || 5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');

  const summary = useMemo(() => {
    const total = reviews.length;
    if (total === 0) {
      return {
        total: 0,
        average: 0,
        counts: [5, 4, 3, 2, 1].map((s) => ({ star: s, count: 0, pct: 0 })),
      };
    }
    const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
    const counts = [5, 4, 3, 2, 1].map((s) => {
      const c = reviews.filter((r) => Number(r.rating) === s).length;
      return { star: s, count: c, pct: Math.round((c / total) * 100) };
    });
    return {
      total,
      average: Math.round((sum / total) * 10) / 10,
      counts,
    };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const list = starFilter ? reviews.filter((r) => Number(r.rating) === starFilter) : [...reviews];
    if (sortBy === 'highest') {
      list.sort((a, b) => b.rating - a.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortBy === 'lowest') {
      list.sort((a, b) => a.rating - b.rating || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [reviews, starFilter, sortBy]);

  const startEditingExisting = () => {
    if (!existingUserReview) return;
    setRating(existingUserReview.rating);
    setComment(existingUserReview.comment);
    setFormError(null);
    setEditingExisting(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmed = comment.trim();
    if (trimmed.length < 5) {
      setFormError('Please write at least 5 characters sharing your experience.');
      return;
    }

    setSubmitting(true);
    try {
      const isEdit = Boolean(existingUserReview && editingExisting);
      await apiFetch(`/api/products/${productId}/reviews`, {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify({ rating, comment: trimmed }),
      });
      notify(isEdit ? 'Your review has been updated' : 'Thank you! Your review has been published');
      setComment('');
      setEditingExisting(false);
      await onReviewSubmitted();
    } catch (err: any) {
      const msg = err.message || 'Unable to submit review';
      setFormError(msg);
      notify(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const displayedStar = hoverRating || rating;

  return (
    <section
      id="customer-reviews"
      className="mt-14 pt-10 border-t"
      style={{ borderColor: 'var(--ag-border)' }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Rating Summary + Submission Card */}
        <div className="lg:col-span-5 space-y-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--ag-muted)' }}>
              Verified Feedback
            </p>
            <h2 className="mt-1 ag-heading text-2xl font-semibold">Customer Reviews</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--ag-muted)' }}>
              {summary.total === 0
                ? `Be the first to review ${productTitle}.`
                : `Based on ${summary.total} customer review${summary.total === 1 ? '' : 's'}`}
            </p>
          </div>

          {/* Summary Breakdown Card */}
          <div className="ag-store-card p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-center pr-4 border-r" style={{ borderColor: 'var(--ag-border)' }}>
                <p className="text-3xl font-bold tabular-nums leading-none">
                  {summary.total > 0 ? summary.average.toFixed(1) : '—'}
                </p>
                <div className="mt-1.5 flex items-center justify-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className="w-3.5 h-3.5"
                      style={
                        n <= Math.round(summary.average)
                          ? { fill: 'var(--ag-accent)', color: 'var(--ag-accent)' }
                          : { color: 'var(--ag-border)' }
                      }
                    />
                  ))}
                </div>
                <p className="mt-1 text-[11px]" style={{ color: 'var(--ag-muted)' }}>
                  {summary.total} {summary.total === 1 ? 'rating' : 'ratings'}
                </p>
              </div>

              <div className="flex-1 space-y-1.5">
                {summary.counts.map((row) => {
                  const active = starFilter === row.star;
                  return (
                    <button
                      key={row.star}
                      type="button"
                      onClick={() => setStarFilter(active ? null : row.star)}
                      className="w-full flex items-center gap-2 text-xs cursor-pointer group"
                      title={`Filter ${row.star}-star reviews`}
                    >
                      <span
                        className="w-8 text-left tabular-nums font-medium"
                        style={{ color: active ? 'var(--ag-ink)' : 'var(--ag-muted)' }}
                      >
                        {row.star} ★
                      </span>
                      <div
                        className="flex-1 h-2 rounded-full overflow-hidden"
                        style={{ backgroundColor: 'var(--ag-surface)' }}
                      >
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${row.pct}%`,
                            backgroundColor: active ? 'var(--ag-ink)' : 'var(--ag-accent)',
                          }}
                        />
                      </div>
                      <span className="w-7 text-right tabular-nums text-[11px]" style={{ color: 'var(--ag-muted)' }}>
                        {row.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {starFilter !== null && (
              <div className="pt-2 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--ag-border)' }}>
                <span style={{ color: 'var(--ag-muted)' }}>
                  Showing {starFilter}-star reviews only
                </span>
                <button
                  type="button"
                  onClick={() => setStarFilter(null)}
                  className="underline font-medium cursor-pointer"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>

          {/* Authenticated Submission Form */}
          {!user ? (
            <div className="ag-store-card p-5 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider">Write a Review</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
                Only signed-in customers can submit star ratings and product reviews.
              </p>
              <div className="pt-1 flex flex-wrap gap-2.5">
                <Link
                  to="/login"
                  className="inline-block px-4 py-2 text-xs font-medium ag-btn-primary"
                >
                  Sign In to Review
                </Link>
                <Link
                  to="/register"
                  className="inline-block px-4 py-2 text-xs font-medium ag-btn-secondary"
                >
                  Create Account
                </Link>
              </div>
            </div>
          ) : existingUserReview && !editingExisting ? (
            <div className="ag-store-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>You reviewed this garment</span>
                </span>
                <button
                  type="button"
                  onClick={startEditingExisting}
                  className="inline-flex items-center gap-1 text-xs underline font-medium cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Review</span>
                </button>
              </div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className="w-3.5 h-3.5"
                    style={
                      n <= existingUserReview.rating
                        ? { fill: 'var(--ag-accent)', color: 'var(--ag-accent)' }
                        : { color: 'var(--ag-border)' }
                    }
                  />
                ))}
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
                &ldquo;{existingUserReview.comment}&rdquo;
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="ag-store-card p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider">
                  {editingExisting ? 'Update Your Review' : 'Write a Review'}
                </p>
                {editingExisting && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingExisting(false);
                      setComment('');
                      setFormError(null);
                    }}
                    className="text-xs underline cursor-pointer"
                    style={{ color: 'var(--ag-muted)' }}
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: 'var(--ag-muted)' }}>
                    Your Rating
                  </span>
                  <span className="text-xs font-medium">
                    {displayedStar} / 5 · {RATING_LABELS[displayedStar]}
                  </span>
                </div>
                <div
                  className="flex items-center gap-1.5"
                  onMouseLeave={() => setHoverRating(0)}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`Rate ${n} out of 5 stars`}
                      onMouseEnter={() => setHoverRating(n)}
                      onClick={() => setRating(n)}
                      className="p-1 cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star
                        className="w-6 h-6"
                        style={
                          n <= displayedStar
                            ? { fill: 'var(--ag-accent)', color: 'var(--ag-accent)' }
                            : { color: 'var(--ag-border)' }
                        }
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--ag-muted)' }}>
                  Your Review
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  minLength={5}
                  maxLength={800}
                  required
                  placeholder="Share fabric quality, fit, stitching, and delivery experience..."
                  className="w-full border bg-white text-[#111827] p-2.5 text-sm focus:outline-none"
                  style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
                />
                <p className="mt-1 text-[11px] text-right tabular-nums" style={{ color: 'var(--ag-muted)' }}>
                  {comment.length} / 800
                </p>
              </div>

              {formError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium cursor-pointer ag-btn-primary disabled:opacity-50"
              >
                {submitting
                  ? 'Submitting...'
                  : editingExisting
                    ? 'Save Updated Review'
                    : 'Submit Review'}
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Reviews Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              {filteredReviews.length}{' '}
              {filteredReviews.length === 1 ? 'Review' : 'Reviews'}
              {starFilter !== null ? ` (${starFilter} ★)` : ''}
            </h3>
            {reviews.length > 1 && (
              <select
                aria-label="Sort reviews"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="border bg-white text-[#111827] px-2.5 py-1.5 text-xs"
                style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
              >
                <option value="newest">Sort: Most Recent</option>
                <option value="highest">Sort: Highest Rating</option>
                <option value="lowest">Sort: Lowest Rating</option>
              </select>
            )}
          </div>

          {filteredReviews.length === 0 ? (
            <div className="ag-store-card p-8 text-center space-y-2">
              <MessageSquare className="w-6 h-6 mx-auto opacity-45" />
              <p className="text-sm font-medium">
                {starFilter !== null
                  ? `No ${starFilter}-star reviews yet`
                  : 'No customer reviews yet'}
              </p>
              <p className="text-xs" style={{ color: 'var(--ag-muted)' }}>
                {starFilter !== null
                  ? 'Try clearing the star filter to view all feedback.'
                  : 'Purchase and share your honest feedback on fit and fabric quality.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((rev) => (
                <article key={rev.id} className="ag-store-card p-5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm">{rev.reviewer_name}</span>
                      {Boolean(rev.is_verified_purchase) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          Verified Buyer
                        </span>
                      )}
                    </div>
                    <span style={{ color: 'var(--ag-muted)' }}>
                      {new Date(rev.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className="w-3.5 h-3.5"
                        style={
                          n <= rev.rating
                            ? { fill: 'var(--ag-accent)', color: 'var(--ag-accent)' }
                            : { color: 'var(--ag-border)' }
                        }
                      />
                    ))}
                    <span className="ml-2 text-[11px] font-medium" style={{ color: 'var(--ag-muted)' }}>
                      {RATING_LABELS[rev.rating]}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed">{rev.comment}</p>

                  {rev.admin_reply && (
                    <div
                      className="mt-3 p-3 border-l-2 text-xs space-y-1"
                      style={{
                        backgroundColor: 'var(--ag-surface)',
                        borderColor: 'var(--ag-accent)',
                      }}
                    >
                      <p className="font-semibold uppercase tracking-wider text-[10px]">
                        Response from Arora Garments
                      </p>
                      <p style={{ color: 'var(--ag-muted)' }}>{rev.admin_reply}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
