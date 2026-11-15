import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Heart, Menu, MessageCircle, Search, ShoppingBag, User, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { apiFetch } from '../lib/api';

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { bootstrap, cart, user, notify } = useStore();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newsletterInput, setNewsletterInput] = useState('');
  const [newsletterSending, setNewsletterSending] = useState(false);
  const navigate = useNavigate();

  const biz = bootstrap?.business_info;
  const branding = bootstrap?.branding;
  const waNumber = (biz?.whatsapp_primary || '919897694349').replace(/\D/g, '');

  const headerLogoUrl = branding?.main_logo_url || branding?.dark_logo_url || '';
  const footerLogoUrl = branding?.light_logo_url || branding?.main_logo_url || '';
  const logoW = Math.min(260, Math.max(60, Number(branding?.logo_width || 160)));
  const logoH = Math.min(64, Math.max(24, Number(branding?.logo_height || 40)));
  const centerLogo = branding?.logo_alignment === 'center';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchOpen(false);
    setMobileMenuOpen(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterInput.trim()) return;
    setNewsletterSending(true);
    try {
      await apiFetch('/api/newsletter', {
        method: 'POST',
        body: JSON.stringify({ contact: newsletterInput.trim() }),
      });
      setNewsletterInput('');
      notify('Subscribed to Arora Garments updates');
    } catch (err: any) {
      notify(err.message || 'Could not subscribe', 'error');
    } finally {
      setNewsletterSending(false);
    }
  };

  const BrandLogo = ({ darkFooter = false }: { darkFooter?: boolean }) => {
    const src = darkFooter ? footerLogoUrl : headerLogoUrl;
    if (src) {
      return (
        <img
          src={src}
          alt={biz?.brand_name || 'ARORA GARMENTS'}
          style={{ maxWidth: `${logoW}px`, maxHeight: `${logoH}px` }}
          className="w-auto h-auto object-contain"
        />
      );
    }
    return (
      <span className="ag-heading text-lg sm:text-xl font-bold tracking-tight whitespace-nowrap">
        {biz?.brand_name || 'ARORA GARMENTS'}
      </span>
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--ag-canvas)', color: 'var(--ag-ink)' }}
    >
      {/* Slim Dismissible Announcement Bar (<= 36px) */}
      {!bannerDismissed && biz?.announcement_enabled !== false && (
        <div
          className="text-xs px-4 h-9 flex items-center justify-between"
          style={{ backgroundColor: 'var(--ag-primary)', color: 'var(--ag-btn-text)' }}
        >
          <div className="w-6 shrink-0" />
          <p className="truncate text-center tracking-wide">
            {biz?.announcement_text ||
              'Local Delivery across Bulandshahr, Sikandrabad, Shikarpur & Jahangirabad · Pan-India Orders via WhatsApp +91 9897694349'}
          </p>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss announcement"
            className="p-1 opacity-75 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Clean 3-Zone Sticky Header */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md border-b"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--ag-canvas) 94%, transparent)',
          borderColor: 'var(--ag-border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-6">
          {/* Left area */}
          <div className={`flex items-center gap-3 ${centerLogo ? 'lg:flex-1' : 'shrink-0'}`}>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 cursor-pointer"
              style={{ color: 'var(--ag-ink)' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            {centerLogo ? (
              <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
                <Link to="/products" className="hover:opacity-70 transition-opacity whitespace-nowrap shrink-0">
                  All Products
                </Link>
                <Link to="/mens-wear" className="hover:opacity-70 transition-opacity whitespace-nowrap shrink-0">
                  Men&apos;s Wear
                </Link>
                <Link to="/womens-wear" className="hover:opacity-70 transition-opacity whitespace-nowrap shrink-0">
                  Women&apos;s Wear
                </Link>
              </nav>
            ) : (
              <Link to="/" className="flex items-center shrink-0">
                <BrandLogo />
              </Link>
            )}
          </div>

          {/* Center area */}
          {centerLogo ? (
            <div className="flex items-center justify-center shrink-0 gap-6">
              <Link to="/" className="flex items-center shrink-0">
                <BrandLogo />
              </Link>
            </div>
          ) : (
            <nav className="hidden lg:flex items-center gap-7 text-sm font-medium">
              <Link to="/products" className="hover:opacity-70 transition-opacity whitespace-nowrap shrink-0">
                All Products
              </Link>
              <Link to="/mens-wear" className="hover:opacity-70 transition-opacity whitespace-nowrap shrink-0">
                Men&apos;s Wear
              </Link>
              <Link to="/womens-wear" className="hover:opacity-70 transition-opacity whitespace-nowrap shrink-0">
                Women&apos;s Wear
              </Link>
              <Link to="/kids-wear" className="hover:opacity-70 transition-opacity whitespace-nowrap shrink-0">
                Kids Wear
              </Link>
              <Link to="/footwear" className="hover:opacity-70 transition-opacity whitespace-nowrap shrink-0">
                Footwear
              </Link>
            </nav>
          )}

          {/* Right Utility Actions */}
          <div className={`flex items-center justify-end gap-1.5 sm:gap-2.5 ${centerLogo ? 'lg:flex-1' : 'shrink-0'}`}>
            {centerLogo && (
              <nav className="hidden lg:flex items-center gap-6 text-sm font-medium mr-2">
                <Link to="/kids-wear" className="hover:opacity-70 transition-opacity whitespace-nowrap shrink-0">
                  Kids Wear
                </Link>
                <Link to="/footwear" className="hover:opacity-70 transition-opacity whitespace-nowrap shrink-0">
                  Footwear
                </Link>
              </nav>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Search catalog"
              className="w-9 h-9 flex items-center justify-center hover:opacity-70 transition-opacity cursor-pointer"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>
            <Link
              to="/wishlist"
              aria-label="Wishlist"
              className="hidden sm:flex w-9 h-9 items-center justify-center hover:opacity-70 transition-opacity"
            >
              <Heart className="w-[18px] h-[18px]" />
            </Link>
            <Link
              to={user ? '/account' : '/login'}
              aria-label="Account"
              className="w-9 h-9 flex items-center justify-center hover:opacity-70 transition-opacity"
            >
              <User className="w-[18px] h-[18px]" />
            </Link>
            <Link
              to="/cart"
              aria-label="Bag"
              className="relative h-9 px-2 flex items-center gap-1.5 text-sm font-medium hover:opacity-70 transition-opacity"
            >
              <ShoppingBag className="w-[18px] h-[18px]" />
              <span className="tabular-nums text-xs font-semibold">{cart.item_count}</span>
            </Link>
          </div>
        </div>

        {/* Expandable Search Bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t bg-white px-4 py-3 overflow-hidden"
              style={{ borderColor: 'var(--ag-border)' }}
            >
              <form onSubmit={handleSearch} className="max-w-3xl mx-auto flex items-center gap-2">
                <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--ag-muted)' }} />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shirts, kurtas, denim, footwear..."
                  className="flex-1 bg-transparent text-sm focus:outline-none py-1.5 text-[#111827]"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ag-btn-primary"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Close search"
                  className="p-1.5 text-[#525866] hover:text-[#111827] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/45"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2 }}
              className="relative w-80 max-w-[85vw] h-full flex flex-col justify-between p-6 overflow-y-auto shadow-xl"
              style={{ backgroundColor: 'var(--ag-canvas)', color: 'var(--ag-ink)' }}
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: 'var(--ag-border)' }}>
                  <BrandLogo />
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-label="Close menu"
                    className="p-2 -mr-2 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form
                  onSubmit={handleSearch}
                  className="mt-4 flex border bg-white"
                  style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search garments..."
                    className="flex-1 px-3 py-2 text-sm text-[#111827] focus:outline-none"
                  />
                  <button type="submit" className="px-3 text-[#111827]" aria-label="Submit search">
                    <Search className="w-4 h-4" />
                  </button>
                </form>

                <div className="mt-6 flex flex-col gap-2.5 text-base font-medium">
                  {[
                    ['/products', 'All Products'],
                    ['/mens-wear', "Men's Wear"],
                    ['/womens-wear', "Women's Wear"],
                    ['/kids-wear', 'Kids Wear'],
                    ['/footwear', 'Footwear'],
                    ['/new-arrivals', 'New Arrivals'],
                    ['/wishlist', 'Wishlist'],
                    ['/track-order', 'Track Order'],
                    ['/store-location', 'Visit Store'],
                  ].map(([to, label]) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileMenuOpen(false)}
                      className="py-2 border-b"
                      style={{ borderColor: 'var(--ag-border)' }}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t flex flex-col gap-2 text-xs" style={{ borderColor: 'var(--ag-border)', color: 'var(--ag-muted)' }}>
                <p>{biz?.operating_hours || 'Mon – Sun · 10:00 AM – 8:30 PM'}</p>
                <p>{biz?.address_line || 'CV59+RH9, Faislabad'}, {biz?.city || 'Bulandshahr'}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Clean Storefront Footer */}
      <footer className="mt-16 bg-[#111827] text-[#F9FAFB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-10 border-b border-white/15">
            <div>
              {footerLogoUrl ? (
                <img
                  src={footerLogoUrl}
                  alt={biz?.brand_name || 'ARORA GARMENTS'}
                  style={{ maxWidth: `${logoW}px`, maxHeight: `${logoH}px` }}
                  className="w-auto h-auto object-contain mb-2"
                />
              ) : (
                <h3 className="ag-heading text-xl font-bold tracking-tight text-white">
                  {biz?.brand_name || 'ARORA GARMENTS'}
                </h3>
              )}
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-white/65">
                {biz?.tagline || 'ULTIMATE FASHION DESTINATION'}
              </p>
              <p className="mt-4 text-sm text-white/80 leading-relaxed">
                {biz?.address_line || 'CV59+RH9, Faislabad'}, {biz?.city || 'Bulandshahr'}, {biz?.state || 'Uttar Pradesh'}{' '}
                {biz?.pincode || '203001'}, {biz?.country || 'India'}.
              </p>
              <p className="mt-2 text-xs text-white/65">
                {biz?.operating_hours || 'Monday – Sunday, 10:00 AM – 8:30 PM'}
              </p>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-[0.12em] font-semibold text-white mb-4">Departments</h4>
              <ul className="space-y-2.5 text-sm text-white/80">
                <li><Link to="/mens-wear" className="hover:text-white transition-colors">Men&apos;s Wear</Link></li>
                <li><Link to="/womens-wear" className="hover:text-white transition-colors">Women&apos;s Wear</Link></li>
                <li><Link to="/kids-wear" className="hover:text-white transition-colors">Kids Wear</Link></li>
                <li><Link to="/footwear" className="hover:text-white transition-colors">Footwear</Link></li>
                <li><Link to="/new-arrivals" className="hover:text-white transition-colors">New Arrivals</Link></li>
                <li><Link to="/best-sellers" className="hover:text-white transition-colors">Best Sellers</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-[0.12em] font-semibold text-white mb-4">Customer Care</h4>
              <ul className="space-y-2.5 text-sm text-white/80">
                <li><Link to="/track-order" className="hover:text-white transition-colors">Track Order</Link></li>
                <li><Link to="/how-to-order" className="hover:text-white transition-colors">How to Order</Link></li>
                <li><Link to="/store-location" className="hover:text-white transition-colors">Store Location</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
                <li><Link to="/shipping-policy" className="hover:text-white transition-colors">Shipping Policy</Link></li>
                <li><Link to="/return-policy" className="hover:text-white transition-colors">Return &amp; Refund Policy</Link></li>
                <li><Link to="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-[0.12em] font-semibold text-white mb-4">Connect &amp; Updates</h4>
              <div className="space-y-1.5 text-sm text-white/80 tabular-nums">
                <p><a href={`tel:${biz?.primary_phone || '+919897694349'}`} className="hover:text-white">{biz?.primary_phone || '+91 9897694349'}</a></p>
                <p><a href={`tel:${biz?.secondary_phone || '+919759147004'}`} className="hover:text-white">{biz?.secondary_phone || '+91 9759147004'}</a></p>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-xs text-white/70">
                <a href={biz?.instagram_1 || 'https://www.instagram.com/arora_garments001/'} target="_blank" rel="noreferrer" className="hover:text-white">
                  Instagram: @arora_garments001
                </a>
                <a href={biz?.instagram_2 || 'https://www.instagram.com/arora._.garments/'} target="_blank" rel="noreferrer" className="hover:text-white">
                  Instagram: @arora._.garments
                </a>
              </div>
              <form onSubmit={handleNewsletter} className="mt-5 flex border border-white/25" style={{ borderRadius: 'var(--ag-btn-radius)' }}>
                <input
                  type="text"
                  value={newsletterInput}
                  onChange={(e) => setNewsletterInput(e.target.value)}
                  placeholder="Email or WhatsApp number"
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none min-w-0"
                />
                <button
                  type="submit"
                  disabled={newsletterSending}
                  className="px-3 py-2 bg-white text-[#111827] text-xs font-semibold hover:bg-gray-100 cursor-pointer whitespace-nowrap"
                >
                  Join
                </button>
              </form>
            </div>
          </div>

          <div className="pt-7 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/65">
            <p>© {new Date().getFullYear()} {biz?.brand_name || 'ARORA GARMENTS'}. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-5">
              <Link to="/about" className="hover:text-white">About</Link>
              <Link to="/privacy-policy" className="hover:text-white">Privacy</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
              <Link to="/admin/login" className="hover:text-white">Admin Portal</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Compact Floating WhatsApp Contact Button */}
      <a
        href={`https://wa.me/${waNumber}?text=${encodeURIComponent('Namaste Arora Garments, I would like assistance with an order.')}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Contact Arora Garments on WhatsApp"
        className="no-print fixed bottom-5 right-5 z-30 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        style={{ backgroundColor: '#15803D', color: '#FFFFFF' }}
      >
        <MessageCircle className="w-5 h-5" />
      </a>
    </div>
  );
}
