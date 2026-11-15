import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';
import type { HeroBanner, HomepageSection, Product } from '../types';
import { SmartImage } from '../components/Fallbacks';
import { ProductCard } from '../components/ProductCard';

const DEPT_DEFAULTS = [
  {
    slug: 'mens-wear',
    title: "Men's Wear",
    subtitle: 'Shirts · Kurtas · Jeans · Formal Wear',
    image: '/assets/catalog/collection_mens_fashion_1794594465072.jpg',
  },
  {
    slug: 'womens-wear',
    title: "Women's Wear",
    subtitle: 'Ethnic Sets · Tops · Traditional · Casual',
    image: '/assets/catalog/collection_womens_ethnic_1794594449450.jpg',
  },
  {
    slug: 'kids-wear',
    title: 'Kids Wear',
    subtitle: 'Boys · Girls · Ethnic · Seasonal',
    image: '/assets/catalog/collection_kids_fashion_1794594449811.jpg',
  },
  {
    slug: 'footwear',
    title: 'Footwear',
    subtitle: 'Sneakers · Loafers · Sandals · Formal',
    image: '/assets/catalog/collection_footwear_edit_1794594449610.jpg',
  },
];

const COLLECTION_IMAGE_FALLBACKS: Record<string, string> = {
  'new-arrivals': '/assets/catalog/collection_mens_fashion_1794594465072.jpg',
  trending: '/assets/catalog/collection_womens_ethnic_1794594449450.jpg',
  'best-sellers': '/assets/catalog/collection_footwear_edit_1794594449610.jpg',
  seasonal: '/assets/catalog/collection_seasonal_festive_1794594450366.jpg',
};

function HeroSliderSection({
  sec,
  bizBrand,
  zonesCount,
  banners,
}: {
  sec: HomepageSection;
  bizBrand: string;
  zonesCount: number;
  banners: HeroBanner[];
}) {
  const slides = useMemo(() => {
    const activeHero = banners
      .filter((b) => (b.placement || 'hero') === 'hero' && b.is_active !== 0)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (activeHero.length > 0) return activeHero;
    return [
      {
        id: sec.id,
        title: sec.title,
        subtitle: sec.subtitle || '',
        cta_label: sec.cta_label || 'Explore Collection',
        link_url: sec.cta_link || '/products',
        image_url: sec.image_url || '/assets/catalog/hero_arora_campaign_1794585862847.jpg',
        placement: 'hero',
        duration_seconds: 8,
      } satisfies HeroBanner,
    ];
  }, [banners, sec]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const safeIndex = currentIndex >= slides.length ? 0 : currentIndex;
  const activeSlide = slides[safeIndex];
  const durationMs = Math.max(3, Math.min(30, Number(activeSlide?.duration_seconds || 8))) * 1000;

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const timer = window.setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [safeIndex, slides.length, paused, durationMs]);

  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const goNext = () => setCurrentIndex((prev) => (prev + 1) % slides.length);

  return (
    <section
      className="border-b"
      style={{ borderColor: 'var(--ag-border)', backgroundColor: 'var(--ag-canvas)' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5 flex flex-col justify-center py-2 lg:py-6">
            <p className="text-xs uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--ag-accent)' }}>
              {bizBrand} · BULANDSHAHR
            </p>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
              >
                <h1 className="mt-3 ag-heading text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.15] tracking-tight text-balance">
                  {activeSlide.title || sec.title}
                </h1>
                <p className="mt-4 text-sm sm:text-base leading-relaxed max-w-lg" style={{ color: 'var(--ag-muted)' }}>
                  {activeSlide.subtitle || sec.subtitle}
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3.5">
                  <Link
                    to={activeSlide.link_url || sec.cta_link || '/products'}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90 whitespace-nowrap ag-btn-primary"
                  >
                    <span>{activeSlide.cta_label || sec.cta_label || 'Explore Collection'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/track-order"
                    className="inline-flex items-center px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ag-btn-secondary hover:opacity-80"
                  >
                    Track Order
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 pt-6 border-t grid grid-cols-3 gap-4 text-xs" style={{ borderColor: 'var(--ag-border)', color: 'var(--ag-muted)' }}>
              <div>
                <p className="font-semibold" style={{ color: 'var(--ag-ink)' }}>4 Departments</p>
                <p className="mt-0.5">Men, Women, Kids &amp; Footwear</p>
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--ag-ink)' }}>{zonesCount} Local PIN Zones</p>
                <p className="mt-0.5">Bulandshahr &amp; 25 km Radius</p>
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--ag-ink)' }}>COD &amp; UPI</p>
                <p className="mt-0.5">Pay on Delivery or WhatsApp UPI</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="relative overflow-hidden ag-store-card">
              <div className="relative w-full h-[300px] sm:h-[400px] lg:h-[480px] overflow-hidden" style={{ backgroundColor: 'var(--ag-surface)' }}>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeSlide.id}
                    src={activeSlide.image_url || '/assets/catalog/hero_arora_campaign_1794585862847.jpg'}
                    alt={activeSlide.title || sec.title}
                    initial={{ opacity: 0.35, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0.35 }}
                    transition={{ duration: 0.4 }}
                    className="w-full h-full object-cover object-center"
                  />
                </AnimatePresence>

                {slides.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      aria-label="Previous slide"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 text-[#111827] border border-[#E5E7EB] flex items-center justify-center shadow-sm hover:bg-white cursor-pointer"
                      style={{ borderRadius: 'var(--ag-btn-radius)' }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      aria-label="Next slide"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 text-[#111827] border border-[#E5E7EB] flex items-center justify-center shadow-sm hover:bg-white cursor-pointer"
                      style={{ borderRadius: 'var(--ag-btn-radius)' }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/45 backdrop-blur-sm px-3 py-1.5" style={{ borderRadius: 'var(--ag-btn-radius)' }}>
                      {slides.map((sl, idx) => (
                        <button
                          key={sl.id}
                          type="button"
                          onClick={() => setCurrentIndex(idx)}
                          aria-label={`View slide ${idx + 1}: ${sl.title}`}
                          className={`h-1.5 transition-all cursor-pointer ${
                            idx === safeIndex ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const { bootstrap } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'featured' | 'newArrival' | 'trending' | 'bestSeller'>('featured');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ products: Product[] }>('/api/products?limit=24')
      .then((res) => setProducts(res.products))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const biz = bootstrap?.business_info;
  const sections: HomepageSection[] = bootstrap?.homepage_sections || [];
  const zonesCount = bootstrap?.serviceable_zones?.length || 9;
  const banners = bootstrap?.banners || [];
  const topCategories = (bootstrap?.categories || []).filter((c) => !c.parent_id && c.is_active !== 0);
  const collections = (bootstrap?.collections || []).filter((c) => c.is_active !== 0);

  const deptCards = DEPT_DEFAULTS.map((def) => {
    const dbCat = topCategories.find((c) => c.slug === def.slug || c.department === def.slug);
    return {
      slug: def.slug,
      title: dbCat?.name || def.title,
      subtitle: dbCat?.description || def.subtitle,
      image: dbCat?.image_url || def.image,
    };
  });

  const filteredTabProducts = products
    .filter((p) => {
      if (activeTab === 'featured') return p.is_featured === 1;
      if (activeTab === 'newArrival') return p.is_new_arrival === 1;
      if (activeTab === 'trending') return p.is_trending === 1;
      return p.is_best_seller === 1;
    })
    .slice(0, 8);

  const displayProducts = filteredTabProducts.length > 0 ? filteredTabProducts : products.slice(0, 8);
  const waNumber = (biz?.whatsapp_primary || '919897694349').replace(/\D/g, '');

  const renderSection = (sec: HomepageSection) => {
    switch (sec.section_type) {
      case 'hero':
        return (
          <HeroSliderSection
            key={sec.id}
            sec={sec}
            bizBrand={biz?.brand_name || 'ARORA GARMENTS'}
            zonesCount={zonesCount}
            banners={banners}
          />
        );

      case 'departments':
        return (
          <section key={sec.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <h2 className="ag-heading text-2xl sm:text-3xl tracking-tight">{sec.title}</h2>
                  {sec.subtitle && <p className="mt-1.5 text-sm max-w-xl" style={{ color: 'var(--ag-muted)' }}>{sec.subtitle}</p>}
                </div>
                <Link to="/products" className="text-sm font-medium underline underline-offset-4 whitespace-nowrap hover:opacity-75">
                  Browse Full Catalog
                </Link>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {deptCards.map((d) => (
                  <Link key={d.slug} to={`/${d.slug}`} className="group block ag-store-card overflow-hidden">
                    <div style={{ backgroundColor: 'var(--ag-surface)' }}>
                      <SmartImage src={d.image} alt={d.title} aspectClass="aspect-[3/4]" />
                    </div>
                    <div className="p-3.5">
                      <h3 className="text-sm sm:text-base font-semibold group-hover:opacity-75 transition-opacity">
                        {d.title}
                      </h3>
                      <p className="mt-0.5 text-xs line-clamp-1" style={{ color: 'var(--ag-muted)' }}>
                        {d.subtitle}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {collections.length > 0 && (
              <div className="pt-8 border-t" style={{ borderColor: 'var(--ag-border)' }}>
                <div className="flex items-end justify-between gap-4 mb-6">
                  <div>
                    <h3 className="ag-heading text-xl sm:text-2xl tracking-tight">Curated Collections</h3>
                    <p className="mt-1 text-xs sm:text-sm" style={{ color: 'var(--ag-muted)' }}>
                      Handpicked edits across new arrivals, trending styles, and seasonal wardrobes.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                  {collections.map((col) => {
                    const colImg =
                      col.banner_image_url ||
                      COLLECTION_IMAGE_FALLBACKS[col.slug] ||
                      '/assets/catalog/collection_seasonal_festive_1794594450366.jpg';
                    return (
                      <Link
                        key={col.id}
                        to={`/${col.slug}`}
                        className="group block ag-store-card overflow-hidden"
                      >
                        <div style={{ backgroundColor: 'var(--ag-surface)' }}>
                          <SmartImage src={colImg} alt={col.name} aspectClass="aspect-[4/3]" />
                        </div>
                        <div className="p-3.5">
                          <h4 className="text-sm font-semibold group-hover:opacity-75 transition-opacity">{col.name}</h4>
                          {col.description && (
                            <p className="mt-0.5 text-xs line-clamp-1" style={{ color: 'var(--ag-muted)' }}>
                              {col.description}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        );

      case 'product_grid':
        return (
          <section key={sec.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t" style={{ borderColor: 'var(--ag-border)' }}>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="ag-heading text-2xl sm:text-3xl tracking-tight">{sec.title}</h2>
                {sec.subtitle && <p className="mt-1.5 text-sm" style={{ color: 'var(--ag-muted)' }}>{sec.subtitle}</p>}
              </div>
              <div
                className="flex flex-wrap items-center gap-1 p-1 border self-start"
                style={{ backgroundColor: 'var(--ag-surface)', borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
              >
                {(
                  [
                    ['featured', 'Featured'],
                    ['newArrival', 'New Arrivals'],
                    ['trending', 'Trending'],
                    ['bestSeller', 'Best Sellers'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className="px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                    style={
                      activeTab === key
                        ? { backgroundColor: 'var(--ag-btn-bg)', color: 'var(--ag-btn-text)', borderRadius: 'var(--ag-btn-radius)' }
                        : { color: 'var(--ag-muted)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="aspect-[3/4] animate-pulse" style={{ backgroundColor: 'var(--ag-surface)' }} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {displayProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            <div className="mt-9 text-center">
              <Link
                to={sec.cta_link || '/products'}
                className="inline-flex items-center gap-2 px-7 py-3 text-sm font-medium transition-opacity hover:opacity-80 ag-btn-secondary"
              >
                <span>{sec.cta_label || 'View All Products'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </section>
        );

      case 'campaign':
        return (
          <section key={sec.id} className="border-y my-6 ag-store-surface" style={{ borderColor: 'var(--ag-border)' }}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6">
                <p className="text-xs uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--ag-accent)' }}>
                  Seasonal Lookbook
                </p>
                <h2 className="mt-2.5 ag-heading text-2xl sm:text-3xl tracking-tight text-balance">
                  {sec.title}
                </h2>
                <p className="mt-3.5 text-sm sm:text-base leading-relaxed max-w-lg" style={{ color: 'var(--ag-muted)' }}>
                  {sec.subtitle}
                </p>
                <Link
                  to={sec.cta_link || '/seasonal'}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90 ag-btn-primary"
                >
                  <span>{sec.cta_label || 'Explore Seasonal Edit'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="lg:col-span-6">
                <div className="overflow-hidden ag-store-card max-h-[420px]">
                  <img
                    src={sec.image_url || '/assets/catalog/collection_seasonal_festive_1794594450366.jpg'}
                    alt={sec.title}
                    className="w-full h-[340px] object-cover object-center"
                  />
                </div>
              </div>
            </div>
          </section>
        );

      case 'whatsapp_enquiry':
        return (
          <section key={sec.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="ag-store-card p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8">
                <p className="text-xs uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--ag-accent)' }}>
                  Pan-India Personal Shopping
                </p>
                <h2 className="mt-2 ag-heading text-2xl sm:text-3xl">{sec.title}</h2>
                <p className="mt-2.5 text-sm max-w-2xl leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
                  {sec.subtitle}
                </p>
              </div>
              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
                <a
                  href={`https://wa.me/${waNumber}?text=${encodeURIComponent('Namaste Arora Garments, I want to enquire about Pan-India ordering.')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90 ag-btn-primary"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{sec.cta_label || 'Enquire on WhatsApp'}</span>
                </a>
                <Link
                  to="/how-to-order"
                  className="inline-flex items-center justify-center px-6 py-3 text-sm font-medium transition-opacity hover:opacity-75 ag-btn-secondary"
                >
                  How Ordering Works
                </Link>
              </div>
            </div>
          </section>
        );

      case 'store_info':
        return (
          <section key={sec.id} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="border-t pt-10 grid grid-cols-1 md:grid-cols-3 gap-8" style={{ borderColor: 'var(--ag-border)' }}>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--ag-muted)' }}>
                  Showroom Address
                </p>
                <h3 className="mt-2 ag-heading text-xl font-semibold">
                  {biz?.brand_name || 'ARORA GARMENTS'}
                </h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ag-muted)' }}>
                  {biz?.address_line || 'CV59+RH9, Faislabad'}, {biz?.city || 'Bulandshahr'},{' '}
                  {biz?.state || 'Uttar Pradesh'} {biz?.pincode || '203001'}, {biz?.country || 'India'}
                </p>
                <a
                  href={biz?.maps_directions_url || 'https://share.google/kfXnT0m9qZV5sQpdK'}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4 hover:opacity-75"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Open in Google Maps</span>
                </a>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--ag-muted)' }}>
                  Opening Hours
                </p>
                <p className="mt-2 text-base font-medium">Monday – Sunday</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--ag-muted)' }}>10:00 AM – 8:30 PM (IST)</p>
                <p className="mt-3 text-xs" style={{ color: 'var(--ag-muted)' }}>
                  Serving Bulandshahr, Sikandrabad, Shikarpur, Jahangirabad, Khurja &amp; nearby towns.
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--ag-muted)' }}>
                  Direct Contact
                </p>
                <div className="mt-2 space-y-1.5 text-sm font-medium tabular-nums">
                  <a href={`tel:${biz?.primary_phone || '+919897694349'}`} className="flex items-center gap-2 hover:opacity-75">
                    <Phone className="w-4 h-4" />
                    <span>{biz?.primary_phone || '+91 9897694349'}</span>
                  </a>
                  <a href={`tel:${biz?.secondary_phone || '+919759147004'}`} className="flex items-center gap-2 hover:opacity-75">
                    <Phone className="w-4 h-4" />
                    <span>{biz?.secondary_phone || '+91 9759147004'}</span>
                  </a>
                </div>
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {sections.length > 0 ? (
        sections.map(renderSection)
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-24 text-center text-sm" style={{ color: 'var(--ag-muted)' }}>
          Loading ARORA GARMENTS...
        </div>
      )}
    </div>
  );
}
