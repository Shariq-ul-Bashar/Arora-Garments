import React, { useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Box,
  CheckCircle2,
  FolderTree,
  Image,
  IndianRupee,
  Layers,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  PackageCheck,
  Palette,
  Settings,
  Shield,
  ShoppingBag,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { apiFetch, setAuthToken } from '../../lib/api';
import { signInWithGoogle } from '../../lib/firebase';

const STAFF_ROLES = ['owner', 'manager', 'order_staff', 'content_staff'];

export function AdminLoginPage() {
  const { user, loading, refreshAuth, logout, notify } = useStore();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isStaff = Boolean(user && user.roles.some((r) => STAFF_ROLES.includes(r)));

  if (!loading && isStaff) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch<{ user: { roles: string[] }; token?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      if (res.token) setAuthToken(res.token);
      const authedUser = await refreshAuth();
      const staffOk = Boolean(authedUser?.roles.some((r) => STAFF_ROLES.includes(r)));
      if (!staffOk) {
        notify('This account does not have administrator permissions.', 'error');
      } else {
        notify('Signed in to Arora Garments Admin');
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err: any) {
      notify(err.message || 'Invalid staff credentials', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleStaffLogin = async () => {
    setSubmitting(true);
    try {
      const { idToken } = await signInWithGoogle();
      const res = await apiFetch<{ user: { roles: string[] }; token?: string }>('/api/auth/firebase-sync', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      if (res.token) setAuthToken(res.token);
      const authedUser = await refreshAuth();
      const staffOk = Boolean(authedUser?.roles.some((r) => STAFF_ROLES.includes(r)));
      if (!staffOk) {
        notify('Your Google account is signed in as a customer without staff access.', 'error');
      } else {
        notify('Signed in to Admin Console');
        navigate('/admin/dashboard', { replace: true });
      }
    } catch (err: any) {
      notify(err.message || 'Google sign-in failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ag-admin-shell min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-md shadow-sm p-8">
        <div className="pb-5 border-b border-gray-200">
          <p className="text-[11px] uppercase tracking-[0.16em] text-amber-700 font-semibold">ARORA GARMENTS</p>
          <h1 className="mt-1.5 text-2xl font-semibold text-gray-900">Administrator Sign In</h1>
          <p className="mt-1 text-xs text-gray-600">
            Restricted staff portal. New staff accounts can only be provisioned by the Store Owner.
          </p>
        </div>

        {!loading && user && !isStaff ? (
          <div className="mt-6 space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900 space-y-1">
              <p className="font-semibold">Unauthorized Account</p>
              <p>
                Signed in as <strong>{user.full_name}</strong> ({user.email || user.phone}), which has customer access only.
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded cursor-pointer hover:bg-gray-800"
            >
              Sign Out &amp; Switch to Staff Account
            </button>
            <Link
              to="/"
              className="block text-center text-xs text-gray-600 underline hover:text-gray-900"
            >
              Return to Storefront
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Staff Email or Mobile</label>
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="owner@aroragarments.in"
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded hover:bg-gray-800 cursor-pointer disabled:opacity-60"
              >
                {submitting ? 'Verifying Credentials...' : 'Sign In to Admin Dashboard'}
              </button>
            </form>

            <div className="relative py-1 flex items-center">
              <div className="flex-1 border-t border-gray-200" />
              <span className="px-2.5 text-[11px] uppercase tracking-wider text-gray-400">or</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <button
              type="button"
              onClick={handleGoogleStaffLogin}
              disabled={submitting}
              className="w-full py-2.5 border border-gray-300 bg-white text-gray-800 text-xs font-medium rounded hover:bg-gray-50 cursor-pointer"
            >
              Sign In with Verified Google Staff Account
            </button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center text-xs text-gray-500">
          <Link to="/" className="underline hover:text-gray-900">
            Return to Storefront
          </Link>
          <span>Role-Based Access Control</span>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const { user, loading, bootstrap, logout } = useStore();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);

  const isStaff = Boolean(user && user.roles.some((r) => STAFF_ROLES.includes(r)));

  if (loading) {
    return (
      <div className="ag-admin-shell min-h-screen flex items-center justify-center p-6 text-sm text-gray-600">
        Verifying administrator session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isStaff) {
    return (
      <div className="ag-admin-shell min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-md p-8 space-y-4">
          <p className="text-xs uppercase tracking-wider text-rose-700 font-semibold">403 · Access Restricted</p>
          <h1 className="text-2xl font-semibold text-gray-900">Administrator Permissions Required</h1>
          <p className="text-xs text-gray-600">
            Your account ({user.email || user.phone || user.full_name}) does not hold a staff role. Sign in with an owner or staff account to access operations.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/admin/login', { replace: true });
              }}
              className="flex-1 py-2.5 bg-gray-900 text-white text-xs font-medium rounded cursor-pointer"
            >
              Switch Account
            </button>
            <Link
              to="/"
              className="flex-1 py-2.5 border border-gray-300 text-center text-xs font-medium text-gray-700 rounded"
            >
              Storefront
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const can = (perm: string) => user.roles.includes('owner') || user.permissions.includes(perm);
  const branding = bootstrap?.branding;

  const navGroups = [
    {
      heading: 'Overview',
      items: [
        { to: '/admin/dashboard', label: 'Dashboard & KPIs', icon: BarChart3, show: true },
        { to: '/admin/analytics', label: 'Analytics & Reports', icon: TrendingUp, show: can('view_analytics') || true },
      ],
    },
    {
      heading: 'Catalog & Stock',
      items: [
        { to: '/admin/products', label: 'Products & Drafts', icon: ShoppingBag, show: can('manage_products') || true },
        { to: '/admin/inventory', label: 'Variant Inventory', icon: Box, show: can('manage_inventory') || true },
        { to: '/admin/categories', label: 'Categories & Coupons', icon: FolderTree, show: can('manage_categories') || can('manage_coupons') || true },
        { to: '/admin/collections', label: 'Collections', icon: Layers, show: can('manage_cms') || true },
        { to: '/admin/reviews', label: 'Customer Reviews', icon: MessageSquare, show: can('manage_products') || can('view_customers') || true },
      ],
    },
    {
      heading: 'Orders & Payments',
      items: [
        { to: '/admin/orders', label: 'Orders & Returns', icon: PackageCheck, show: can('manage_orders') || true },
        { to: '/admin/payments', label: 'UPI Payments Queue', icon: IndianRupee, show: can('manage_orders') || true },
        { to: '/admin/customers', label: 'Customers', icon: Users, show: can('view_customers') },
      ],
    },
    {
      heading: 'Design & Storefront',
      items: [
        { to: '/admin/appearance', label: 'Themes & Fonts (6)', icon: Palette, show: can('manage_settings') || can('manage_cms') || true },
        { to: '/admin/settings/branding', label: 'Logo & Branding', icon: Image, show: can('manage_settings') || true },
        { to: '/admin/shipping-zones', label: 'Delivery Zones (PIN)', icon: MapPin, show: can('manage_settings') || true },
        { to: '/admin/settings', label: 'Store, UPI QR & CMS', icon: Settings, show: can('manage_settings') || can('manage_cms') || true },
        { to: '/admin/staff', label: 'Staff & Audit Logs', icon: Shield, show: user.roles.includes('owner') || can('view_analytics') },
      ],
    },
  ];

  const handleSignOut = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full justify-between p-4">
      <div>
        <div className="pb-4 border-b border-gray-200">
          {branding?.main_logo_url ? (
            <Link to="/" className="block">
              <img
                src={branding.main_logo_url}
                alt="Arora Garments"
                className="h-8 w-auto object-contain"
              />
            </Link>
          ) : (
            <Link to="/" className="text-lg font-semibold tracking-tight text-gray-900">
              ARORA GARMENTS
            </Link>
          )}
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{user.roles.filter((r) => r !== 'customer').join(', ')} Console</span>
          </div>
        </div>

        <nav className="mt-4 space-y-5">
          {navGroups.map((grp) => {
            const visibleItems = grp.items.filter((i) => i.show);
            if (visibleItems.length === 0) return null;
            return (
              <div key={grp.heading}>
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {grp.heading}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileNav(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 mt-6 border-t border-gray-200 space-y-2 text-xs">
        <p className="font-medium text-gray-900 truncate">{user.full_name}</p>
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-rose-700 hover:text-rose-900 inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ag-admin-shell min-h-screen flex">
      <aside className="hidden lg:block w-64 bg-white border-r border-gray-200 shrink-0 sticky top-0 h-screen overflow-y-auto">
        <SidebarContent />
      </aside>

      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
          <div className="relative w-64 bg-white h-full border-r border-gray-200 overflow-y-auto">
            <button
              type="button"
              onClick={() => setMobileNav(false)}
              className="absolute top-3.5 right-3.5 p-1 text-gray-600 cursor-pointer"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              className="lg:hidden p-1.5 text-gray-700 cursor-pointer"
              aria-label="Open admin menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-medium text-gray-600">ARORA GARMENTS · Operations Console</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/admin/appearance" className="hidden sm:inline text-gray-600 hover:text-gray-900">
              Themes
            </Link>
            <Link to="/admin/payments" className="hidden sm:inline text-gray-600 hover:text-gray-900">
              UPI Queue
            </Link>
            <Link to="/" className="font-medium underline underline-offset-4 text-gray-900">
              View Live Store
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
