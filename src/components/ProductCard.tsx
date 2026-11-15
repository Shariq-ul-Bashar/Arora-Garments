import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { DEPARTMENT_LABELS, formatINR } from '../lib/api';
import type { Product } from '../types';
import { SmartImage } from './Fallbacks';

export function ProductCard({ product }: { product: Product }) {
  const { wishlistIds, toggleWishlist } = useStore();
  const inWishlist = wishlistIds.has(product.id);
  const primaryImg = product.images?.[0]?.image_url || null;
  const displayTitle = product.title;

  return (
    <article className="group flex flex-col ag-store-card overflow-hidden transition-transform duration-200 hover:-translate-y-0.5">
      <div className="relative overflow-hidden" style={{ backgroundColor: 'var(--ag-surface)' }}>
        <Link to={`/product/${product.slug}`} className="block">
          <SmartImage src={primaryImg} alt={product.title} aspectClass="aspect-[3/4]" />
        </Link>
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-label={inWishlist ? 'Remove from wishlist' : 'Save to wishlist'}
          className="absolute top-2.5 right-2.5 w-8 h-8 flex items-center justify-center bg-white/95 text-[#111827] border transition-colors cursor-pointer"
          style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
        >
          <Heart className={`w-4 h-4 ${inWishlist ? 'fill-current' : ''}`} style={inWishlist ? { color: 'var(--ag-accent)' } : undefined} />
        </button>
      </div>

      <div className="p-3.5 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.06em]" style={{ color: 'var(--ag-muted)' }}>
          <span className="truncate">{DEPARTMENT_LABELS[product.department] || product.department}</span>
          {product.subcategory_name && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{product.subcategory_name}</span>
            </>
          )}
          {product.total_stock === 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#991B1B] font-semibold">Sold Out</span>
            </>
          )}
        </div>

        <Link
          to={`/product/${product.slug}`}
          className="text-sm sm:text-[15px] font-medium line-clamp-1 hover:opacity-75 transition-opacity"
          style={{ color: 'var(--ag-ink)' }}
        >
          {displayTitle}
        </Link>

        <div className="flex items-baseline gap-2 tabular-nums text-sm sm:text-[15px] pt-0.5">
          <span className="font-semibold" style={{ color: 'var(--ag-ink)' }}>
            {formatINR(product.effective_price)}
          </span>
          {product.discount_percentage > 0 && (
            <>
              <span className="text-xs line-through" style={{ color: 'var(--ag-muted)' }}>
                {formatINR(product.regular_price)}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--ag-accent)' }}>
                {product.discount_percentage}% off
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
