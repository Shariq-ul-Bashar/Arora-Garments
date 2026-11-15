import React, { Component, Suspense, lazy } from 'react';
import { MotionConfig } from 'motion/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { StorefrontLayout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage, CheckoutPage, OrderConfirmationPage } from './pages/CartAndCheckoutPages';
import {
  AccountPage,
  LoginPage,
  MyOrdersPage,
  OrderDetailPage,
  RegisterPage,
  WishlistPage,
} from './pages/AccountPages';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import {
  AboutPage,
  ContactPage,
  FaqPage,
  HowToOrderPage,
  PrivacyPolicyPage,
  ReturnPolicyPage,
  ShippingPolicyPage,
  StoreLocationPage,
  TermsPage,
} from './pages/InfoPages';

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLoginPage })));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview').then((m) => ({ default: m.AdminOverview })));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminOverview').then((m) => ({ default: m.AdminAnalyticsPage })));
const AdminProducts = lazy(() => import('./pages/admin/AdminCatalog').then((m) => ({ default: m.AdminProducts })));
const AdminInventory = lazy(() => import('./pages/admin/AdminCatalog').then((m) => ({ default: m.AdminInventory })));
const AdminReviewsPage = lazy(() => import('./pages/admin/AdminReviews').then((m) => ({ default: m.AdminReviewsPage })));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders').then((m) => ({ default: m.AdminOrders })));
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminOrders').then((m) => ({ default: m.AdminPaymentsPage })));
const AdminAppearancePage = lazy(() =>
  import('./pages/admin/AdminAppearanceAndBranding').then((m) => ({ default: m.AdminAppearancePage }))
);
const AdminBrandingPage = lazy(() =>
  import('./pages/admin/AdminAppearanceAndBranding').then((m) => ({ default: m.AdminBrandingPage }))
);
const AdminShippingZonesPage = lazy(() =>
  import('./pages/admin/AdminAppearanceAndBranding').then((m) => ({ default: m.AdminShippingZonesPage }))
);
const AdminCategoriesPage = lazy(() =>
  import('./pages/admin/AdminCmsAndTeam').then((m) => ({ default: m.AdminCategoriesPage }))
);
const AdminCollectionsPage = lazy(() =>
  import('./pages/admin/AdminCmsAndTeam').then((m) => ({ default: m.AdminCollectionsPage }))
);
const AdminCustomers = lazy(() => import('./pages/admin/AdminCmsAndTeam').then((m) => ({ default: m.AdminCustomers })));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminCmsAndTeam').then((m) => ({ default: m.AdminSettingsPage })));
const AdminTeam = lazy(() => import('./pages/admin/AdminCmsAndTeam').then((m) => ({ default: m.AdminTeam })));

class AppErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Unhandled storefront error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAF9F6] text-[#111827]">
          <div className="max-w-md w-full border border-[#E5E7EB] bg-white p-8 text-center space-y-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#6B7280]">ARORA GARMENTS</p>
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-[#4B5563]">
              An unexpected error interrupted this view. Please reload the page to continue shopping.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 text-xs font-medium bg-[#111827] text-white cursor-pointer"
              >
                Reload Page
              </button>
              <a href="/" className="px-5 py-2.5 text-xs font-medium border border-[#D1D5DB] text-[#111827]">
                Back to Home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function StoreRoute({ element }: { element: React.ReactNode }) {
  return <StorefrontLayout>{element}</StorefrontLayout>;
}

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center text-xs tracking-wider uppercase text-gray-500">
      Loading ARORA GARMENTS...
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppErrorBoundary>
        <BrowserRouter>
          <StoreProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {/* Customer Storefront Routes */}
                <Route path="/" element={<StoreRoute element={<HomePage />} />} />
                <Route path="/products" element={<StoreRoute element={<CatalogPage pageTitle="All Products" />} />} />
                <Route path="/mens-wear" element={<StoreRoute element={<CatalogPage fixedDepartment="mens-wear" />} />} />
                <Route path="/womens-wear" element={<StoreRoute element={<CatalogPage fixedDepartment="womens-wear" />} />} />
                <Route path="/kids-wear" element={<StoreRoute element={<CatalogPage fixedDepartment="kids-wear" />} />} />
                <Route path="/footwear" element={<StoreRoute element={<CatalogPage fixedDepartment="footwear" />} />} />
                <Route path="/category/:slug" element={<StoreRoute element={<CatalogPage />} />} />
                <Route path="/new-arrivals" element={<StoreRoute element={<CatalogPage fixedCollection="new-arrivals" pageTitle="New Arrivals" />} />} />
                <Route path="/trending" element={<StoreRoute element={<CatalogPage fixedCollection="trending" pageTitle="Trending Collection" />} />} />
                <Route path="/best-sellers" element={<StoreRoute element={<CatalogPage fixedCollection="best-sellers" pageTitle="Best Sellers" />} />} />
                <Route path="/seasonal" element={<StoreRoute element={<CatalogPage fixedCollection="seasonal" pageTitle="Seasonal Collections" />} />} />
                <Route path="/product/:slug" element={<StoreRoute element={<ProductDetailPage />} />} />
                <Route path="/search" element={<StoreRoute element={<CatalogPage />} />} />
                <Route path="/wishlist" element={<StoreRoute element={<WishlistPage />} />} />
                <Route path="/cart" element={<StoreRoute element={<CartPage />} />} />
                <Route path="/checkout" element={<StoreRoute element={<CheckoutPage />} />} />
                <Route path="/order-confirmation/:orderNumber" element={<StoreRoute element={<OrderConfirmationPage />} />} />
                <Route path="/login" element={<StoreRoute element={<LoginPage />} />} />
                <Route path="/register" element={<StoreRoute element={<RegisterPage />} />} />
                <Route path="/account" element={<StoreRoute element={<AccountPage />} />} />
                <Route path="/orders" element={<StoreRoute element={<MyOrdersPage />} />} />
                <Route path="/orders/:id" element={<StoreRoute element={<OrderDetailPage />} />} />
                <Route path="/track-order" element={<StoreRoute element={<OrderTrackingPage />} />} />
                <Route path="/about" element={<StoreRoute element={<AboutPage />} />} />
                <Route path="/how-to-order" element={<StoreRoute element={<HowToOrderPage />} />} />
                <Route path="/contact" element={<StoreRoute element={<ContactPage />} />} />
                <Route path="/store-location" element={<StoreRoute element={<StoreLocationPage />} />} />
                <Route path="/faq" element={<StoreRoute element={<FaqPage />} />} />
                <Route path="/shipping-policy" element={<StoreRoute element={<ShippingPolicyPage />} />} />
                <Route path="/return-policy" element={<StoreRoute element={<ReturnPolicyPage />} />} />
                <Route path="/privacy-policy" element={<StoreRoute element={<PrivacyPolicyPage />} />} />
                <Route path="/terms" element={<StoreRoute element={<TermsPage />} />} />

                {/* Dedicated Administrator Routes (lazy-loaded chunks) */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="dashboard" element={<AdminOverview />} />
                  <Route path="analytics" element={<AdminAnalyticsPage />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="inventory" element={<AdminInventory />} />
                  <Route path="categories" element={<AdminCategoriesPage />} />
                  <Route path="collections" element={<AdminCollectionsPage />} />
                  <Route path="reviews" element={<AdminReviewsPage />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="payments" element={<AdminPaymentsPage />} />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route path="appearance" element={<AdminAppearancePage />} />
                  <Route path="settings" element={<AdminSettingsPage />} />
                  <Route path="settings/branding" element={<AdminBrandingPage />} />
                  <Route path="shipping-zones" element={<AdminShippingZonesPage />} />
                  <Route path="staff" element={<AdminTeam />} />
                  {/* Legacy route aliases */}
                  <Route path="taxonomy" element={<Navigate to="/admin/categories" replace />} />
                  <Route path="cms" element={<Navigate to="/admin/settings" replace />} />
                  <Route path="team" element={<Navigate to="/admin/staff" replace />} />
                </Route>

                {/* Fallback to Home */}
                <Route path="*" element={<StoreRoute element={<HomePage />} />} />
              </Routes>
            </Suspense>
          </StoreProvider>
        </BrowserRouter>
      </AppErrorBoundary>
    </MotionConfig>
  );
}
