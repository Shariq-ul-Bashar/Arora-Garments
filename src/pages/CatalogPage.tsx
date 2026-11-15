import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch, DEPARTMENT_LABELS } from '../lib/api';
import type { Product } from '../types';
import { ProductCard } from '../components/ProductCard';

interface CatalogPageProps {
  fixedDepartment?: string;
  fixedCollection?: 'new-arrivals' | 'trending' | 'best-sellers' | 'seasonal';
  pageTitle?: string;
}

export function CatalogPage({ fixedDepartment, fixedCollection, pageTitle }: CatalogPageProps) {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { bootstrap } = useStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [facets, setFacets] = useState<{ sizes: string[]; colors: Array<{ color: string; color_hex: string }>; productTypes: string[] }>({
    sizes: [],
    colors: [],
    productTypes: [],
  });
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [department, setDepartment] = useState(fixedDepartment || searchParams.get('department') || 'all');
  const [categorySlug, setCategorySlug] = useState(slug || searchParams.get('category') || '');
  const [selectedSize, setSelectedSize] = useState(searchParams.get('size') || '');
  const [selectedColor, setSelectedColor] = useState(searchParams.get('color') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [inStockOnly, setInStockOnly] = useState(searchParams.get('inStock') === 'true');
  const [onDiscountOnly, setOnDiscountOnly] = useState(searchParams.get('onDiscount') === 'true');
  const [productType, setProductType] = useState(searchParams.get('productType') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');

  useEffect(() => {
    setDepartment(fixedDepartment || searchParams.get('department') || 'all');
    setCategorySlug(slug || searchParams.get('category') || '');
    setQuery(searchParams.get('q') || '');
  }, [fixedDepartment, slug, searchParams]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (department && department !== 'all') params.set('department', department);
    if (categorySlug) params.set('category', categorySlug);
    if (fixedCollection === 'new-arrivals') params.set('newArrival', 'true');
    if (fixedCollection === 'trending') params.set('trending', 'true');
    if (fixedCollection === 'best-sellers') params.set('bestSeller', 'true');
    if (fixedCollection === 'seasonal') params.set('collection', 'seasonal');
    if (selectedSize) params.set('size', selectedSize);
    if (selectedColor) params.set('color', selectedColor);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (inStockOnly) params.set('inStock', 'true');
    if (onDiscountOnly) params.set('onDiscount', 'true');
    if (productType) params.set('productType', productType);
    if (sort) params.set('sort', sort);

    apiFetch<{ products: Product[]; facets: typeof facets }>(`/api/products?${params.toString()}`)
      .then((res) => {
        setProducts(res.products);
        setFacets(res.facets);
      })
      .finally(() => setLoading(false));
  }, [
    query,
    department,
    categorySlug,
    fixedCollection,
    selectedSize,
    selectedColor,
    maxPrice,
    inStockOnly,
    onDiscountOnly,
    productType,
    sort,
  ]);

  const categories = bootstrap?.categories || [];
  const subCategories = categories.filter(
    (c) => c.parent_id && (department === 'all' || c.department === department)
  );

  const heading =
    pageTitle ||
    (categorySlug
      ? categories.find((c) => c.slug === categorySlug)?.name || categorySlug.replace(/-/g, ' ')
      : fixedDepartment
        ? DEPARTMENT_LABELS[fixedDepartment]
        : query
          ? `Search: "${query}"`
          : 'All Products');

  const clearFilters = () => {
    setSelectedSize('');
    setSelectedColor('');
    setMaxPrice('');
    setInStockOnly(false);
    setOnDiscountOnly(false);
    setProductType('');
    if (!fixedDepartment) setDepartment('all');
    if (!slug) setCategorySlug('');
    setQuery('');
    setSearchParams({});
  };

  const FilterPanel = () => (
    <div className="space-y-6 text-sm">
      {!fixedDepartment && (
        <div>
          <h4 className="text-xs uppercase tracking-[0.1em] font-semibold mb-3" style={{ color: 'var(--ag-muted)' }}>
            Department
          </h4>
          <div className="flex flex-col gap-1.5">
            {[
              ['all', 'All Departments'],
              ['mens-wear', "Men's Wear"],
              ['womens-wear', "Women's Wear"],
              ['kids-wear', 'Kids Wear'],
              ['footwear', 'Footwear'],
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setDepartment(val);
                  setCategorySlug('');
                }}
                className="text-left py-1 transition-opacity cursor-pointer hover:opacity-80"
                style={{
                  fontWeight: department === val ? 600 : 400,
                  color: department === val ? 'var(--ag-ink)' : 'var(--ag-muted)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {subCategories.length > 0 && (
        <div className="pt-4 border-t" style={{ borderColor: 'var(--ag-border)' }}>
          <h4 className="text-xs uppercase tracking-[0.1em] font-semibold mb-3" style={{ color: 'var(--ag-muted)' }}>
            Category
          </h4>
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => setCategorySlug('')}
              className="text-left py-0.5 cursor-pointer"
              style={{
                fontWeight: !categorySlug ? 600 : 400,
                color: !categorySlug ? 'var(--ag-ink)' : 'var(--ag-muted)',
              }}
            >
              All Categories
            </button>
            {subCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategorySlug(c.slug)}
                className="text-left py-0.5 cursor-pointer"
                style={{
                  fontWeight: categorySlug === c.slug ? 600 : 400,
                  color: categorySlug === c.slug ? 'var(--ag-ink)' : 'var(--ag-muted)',
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t" style={{ borderColor: 'var(--ag-border)' }}>
        <h4 className="text-xs uppercase tracking-[0.1em] font-semibold mb-3" style={{ color: 'var(--ag-muted)' }}>
          Max Price (INR)
        </h4>
        <div className="flex flex-wrap gap-2">
          {['1500', '2500', '3500', '5000'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setMaxPrice(maxPrice === p ? '' : p)}
              className="px-2.5 py-1 text-xs border tabular-nums cursor-pointer"
              style={
                maxPrice === p
                  ? { backgroundColor: 'var(--ag-btn-bg)', color: 'var(--ag-btn-text)', borderColor: 'var(--ag-btn-bg)', borderRadius: 'var(--ag-btn-radius)' }
                  : { borderColor: 'var(--ag-border)', color: 'var(--ag-ink)', borderRadius: 'var(--ag-btn-radius)' }
              }
            >
              Under ₹{p}
            </button>
          ))}
        </div>
      </div>

      {facets.sizes.length > 0 && (
        <div className="pt-4 border-t" style={{ borderColor: 'var(--ag-border)' }}>
          <h4 className="text-xs uppercase tracking-[0.1em] font-semibold mb-3" style={{ color: 'var(--ag-muted)' }}>
            Size
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {facets.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSize(selectedSize === s ? '' : s)}
                className="px-2.5 py-1 text-xs border cursor-pointer"
                style={
                  selectedSize === s
                    ? { backgroundColor: 'var(--ag-btn-bg)', color: 'var(--ag-btn-text)', borderColor: 'var(--ag-btn-bg)', borderRadius: 'var(--ag-btn-radius)' }
                    : { borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {facets.colors.length > 0 && (
        <div className="pt-4 border-t" style={{ borderColor: 'var(--ag-border)' }}>
          <h4 className="text-xs uppercase tracking-[0.1em] font-semibold mb-3" style={{ color: 'var(--ag-muted)' }}>
            Colour
          </h4>
          <div className="flex flex-col gap-1.5">
            {facets.colors.map((c, idx) => (
              <button
                key={`${c.color}-${c.color_hex}-${idx}`}
                type="button"
                onClick={() => setSelectedColor(selectedColor === c.color ? '' : c.color)}
                className="flex items-center gap-2 text-left text-xs py-0.5 cursor-pointer"
                style={{
                  fontWeight: selectedColor === c.color ? 600 : 400,
                  color: selectedColor === c.color ? 'var(--ag-ink)' : 'var(--ag-muted)',
                }}
              >
                <span className="w-3.5 h-3.5 border border-black/20 shrink-0" style={{ backgroundColor: c.color_hex }} />
                <span>{c.color}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {facets.productTypes.length > 0 && (
        <div className="pt-4 border-t" style={{ borderColor: 'var(--ag-border)' }}>
          <h4 className="text-xs uppercase tracking-[0.1em] font-semibold mb-3" style={{ color: 'var(--ag-muted)' }}>
            Product Type
          </h4>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            className="w-full border bg-white px-2.5 py-1.5 text-xs text-[#111827]"
            style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
          >
            <option value="">All Types</option>
            {facets.productTypes.map((pt) => (
              <option key={pt} value={pt}>
                {pt}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="pt-4 border-t space-y-2.5" style={{ borderColor: 'var(--ag-border)' }}>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
          <span>In Stock Only</span>
        </label>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={onDiscountOnly} onChange={(e) => setOnDiscountOnly(e.target.checked)} />
          <span>On Discount</span>
        </label>
      </div>

      <button
        type="button"
        onClick={clearFilters}
        className="w-full py-2 text-xs font-medium cursor-pointer ag-btn-secondary"
      >
        Reset All Filters
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-9">
      {/* Header & Controls */}
      <div className="pb-5 border-b flex flex-col sm:flex-row sm:items-end justify-between gap-4" style={{ borderColor: 'var(--ag-border)' }}>
        <div>
          <p className="text-xs uppercase tracking-[0.1em]" style={{ color: 'var(--ag-muted)' }}>
            ARORA GARMENTS · {products.length} {products.length === 1 ? 'Item' : 'Items'}
          </p>
          <h1 className="mt-1 ag-heading text-2xl sm:text-3xl capitalize">{heading}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden inline-flex items-center gap-2 px-4 py-2 border bg-white text-[#111827] text-xs font-medium cursor-pointer"
            style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border bg-white px-3 py-2 text-xs font-medium text-[#111827]"
            style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
          >
            <option value="newest">Sort: Newest</option>
            <option value="popularity">Sort: Popularity</option>
            <option value="best_selling">Sort: Best Selling</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="hidden lg:block lg:col-span-3">
          <FilterPanel />
        </aside>

        <div className="lg:col-span-9">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="aspect-[3/4] animate-pulse" style={{ backgroundColor: 'var(--ag-surface)' }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="ag-store-card p-10 text-center">
              <p className="ag-heading text-xl">No matching products found</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--ag-muted)' }}>
                Try clearing a filter or searching by department, product type, or SKU.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 px-6 py-2.5 text-xs font-medium cursor-pointer ag-btn-primary"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileFiltersOpen(false)} />
          <div className="relative w-80 max-w-[85vw] h-full p-6 overflow-y-auto" style={{ backgroundColor: 'var(--ag-canvas)' }}>
            <div className="flex items-center justify-between pb-4 border-b mb-5" style={{ borderColor: 'var(--ag-border)' }}>
              <h3 className="ag-heading text-lg font-semibold">Filters</h3>
              <button type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters" className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <FilterPanel />
          </div>
        </div>
      )}
    </div>
  );
}
