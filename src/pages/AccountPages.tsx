import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileDown, LogOut, MapPin, Package, Printer, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  apiFetch,
  downloadInvoicePdf,
  formatINR,
  paymentMethodLabel,
  paymentStatusBadgeClass,
  paymentStatusLabel,
  setAuthToken,
} from '../lib/api';
import { signInWithGoogle } from '../lib/firebase';
import type { OrderRecord, Product } from '../types';
import { ProductCard } from '../components/ProductCard';

export function LoginPage() {
  const { refreshAuth, notify } = useStore();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetRequested, setResetRequested] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch<{ user: { roles: string[] }; token?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      if (res.token) setAuthToken(res.token);
      await refreshAuth();
      notify('Signed in successfully');
      if (res.user.roles.some((r) => ['owner', 'manager', 'order_staff', 'content_staff'].includes(r))) {
        navigate('/admin/dashboard');
      } else {
        navigate('/account');
      }
    } catch (err: any) {
      notify(err.message || 'Sign in failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { idToken } = await signInWithGoogle();
      const res = await apiFetch<{ user: { roles: string[] }; token?: string }>('/api/auth/firebase-sync', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      if (res.token) setAuthToken(res.token);
      await refreshAuth();
      notify('Signed in with Google');
      if (res.user.roles.some((r) => ['owner', 'manager', 'order_staff', 'content_staff'].includes(r))) {
        navigate('/admin/dashboard');
      } else {
        navigate('/account');
      }
    } catch (err: any) {
      notify(err.message || 'Google sign-in failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      });
      setResetRequested(true);
      notify(res.message);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ identifier, reset_code: resetCode, new_password: newPassword }),
      });
      notify('Password updated. Please sign in.');
      setResetMode(false);
      setResetRequested(false);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="ag-store-card p-7 sm:p-8">
        <h1 className="ag-heading text-2xl sm:text-3xl font-semibold">
          {resetMode ? 'Reset Password' : 'Customer Sign In'}
        </h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--ag-muted)' }}>
          {resetMode
            ? 'Enter your registered phone or email to reset your password.'
            : 'Access your orders, saved addresses, and wishlist.'}
        </p>

        {!resetMode ? (
          <div className="mt-6 space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Mobile Number or Email</label>
                <input
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Password</label>
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm"
                  style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-sm font-semibold hover:opacity-90 cursor-pointer ag-btn-primary"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t" style={{ borderColor: 'var(--ag-border)' }} />
              <span className="flex-shrink mx-3 text-[11px] uppercase" style={{ color: 'var(--ag-muted)' }}>or</span>
              <div className="flex-grow border-t" style={{ borderColor: 'var(--ag-border)' }} />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 border bg-white text-[#111827] text-xs font-semibold hover:bg-gray-50 cursor-pointer flex items-center justify-center gap-2"
              style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
            >
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center justify-between text-xs pt-2">
              <button type="button" onClick={() => setResetMode(true)} className="underline cursor-pointer" style={{ color: 'var(--ag-muted)' }}>
                Forgot password?
              </button>
              <Link to="/register" className="underline font-medium">
                Create Account
              </Link>
            </div>
          </div>
        ) : !resetRequested ? (
          <form onSubmit={handleForgot} className="mt-6 space-y-4">
            <input
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Registered mobile or email"
              className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
            />
            <button type="submit" className="w-full py-3 text-sm font-medium cursor-pointer ag-btn-primary">
              Request Reset Code
            </button>
            <button type="button" onClick={() => setResetMode(false)} className="text-xs underline cursor-pointer">
              Back to Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="mt-6 space-y-4">
            <input
              required
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
              placeholder="6-digit verification code"
              className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
            />
            <input
              required
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm"
              style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }}
            />
            <button type="submit" className="w-full py-3 text-sm font-medium cursor-pointer ag-btn-primary">
              Save New Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { refreshAuth, notify } = useStore();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch<{ token?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName, phone, email, password }),
      });
      if (res.token) setAuthToken(res.token);
      await refreshAuth();
      notify('Account created');
      navigate('/account');
    } catch (err: any) {
      notify(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="ag-store-card p-7 sm:p-8">
        <h1 className="ag-heading text-2xl sm:text-3xl font-semibold">Create Account</h1>
        <p className="mt-1 text-xs" style={{ color: 'var(--ag-muted)' }}>
          Register to track deliveries, download invoices, and manage your wishlist.
        </p>
        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Full Name *</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Mobile Number *</label>
            <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email Address (Optional)</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Password *</label>
            <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2.5 text-sm" style={{ borderColor: 'var(--ag-border)', borderRadius: 'var(--ag-btn-radius)' }} />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 text-sm font-semibold cursor-pointer ag-btn-primary">
            {loading ? 'Creating...' : 'Register'}
          </button>
        </form>
        <p className="mt-4 text-xs" style={{ color: 'var(--ag-muted)' }}>
          Already registered? <Link to="/login" className="underline font-medium" style={{ color: 'var(--ag-ink)' }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
}

export function AccountPage() {
  const { user, logout, refreshAuth, notify } = useStore();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addrForm, setAddrForm] = useState({
    full_name: '',
    mobile: '',
    address_line: '',
    locality: '',
    city: 'Bulandshahr',
    state: 'Uttar Pradesh',
    pincode: '203001',
    is_default: true,
  });

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setEmail(user.email || '');
      apiFetch<{ addresses: any[] }>('/api/addresses').then((r) => setAddresses(r.addresses)).catch(() => {});
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-sm" style={{ color: 'var(--ag-muted)' }}>Please sign in to view your account.</p>
        <Link to="/login" className="mt-4 inline-block px-6 py-2.5 text-xs font-medium ag-btn-primary">
          Sign In
        </Link>
      </div>
    );
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ full_name: fullName, email }),
    });
    await refreshAuth();
    notify('Profile updated');
  };

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/addresses', { method: 'POST', body: JSON.stringify(addrForm) });
    const r = await apiFetch<{ addresses: any[] }>('/api/addresses');
    setAddresses(r.addresses);
    notify('Address saved');
  };

  const deleteAddress = async (id: string) => {
    await apiFetch(`/api/addresses/${id}`, { method: 'DELETE' });
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const isStaff = user.roles.some((r) => ['owner', 'manager', 'order_staff', 'content_staff'].includes(r));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b" style={{ borderColor: 'var(--ag-border)' }}>
        <div>
          <h1 className="ag-heading text-2xl sm:text-3xl font-semibold">My Account</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--ag-muted)' }}>{user.full_name} · {user.phone || user.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isStaff && (
            <Link to="/admin/dashboard" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium ag-btn-primary">
              Open Admin Dashboard
            </Link>
          )}
          <Link to="/orders" className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium ag-btn-secondary">
            <Package className="w-3.5 h-3.5" />
            <span>My Orders</span>
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium cursor-pointer ag-btn-secondary"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={saveProfile} className="lg:col-span-5 ag-store-card p-6 space-y-4 h-fit">
          <h2 className="ag-heading text-xl font-semibold">Profile Details</h2>
          <div>
            <label className="block text-xs font-medium mb-1">Full Name</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2 text-sm" style={{ borderColor: 'var(--ag-border)' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border bg-white text-[#111827] px-3 py-2 text-sm" style={{ borderColor: 'var(--ag-border)' }} />
          </div>
          <button type="submit" className="px-5 py-2.5 text-xs font-medium cursor-pointer ag-btn-primary">
            Update Profile
          </button>
        </form>

        <div className="lg:col-span-7 space-y-6">
          <div className="ag-store-card p-6 space-y-4">
            <h2 className="ag-heading text-xl font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              <span>Saved Addresses</span>
            </h2>
            {addresses.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--ag-muted)' }}>No saved addresses yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((a) => (
                  <div key={a.id} className="border p-4 text-xs flex justify-between gap-2 bg-white text-[#111827]" style={{ borderColor: 'var(--ag-border)' }}>
                    <div>
                      <p className="font-semibold">{a.full_name} {a.is_default ? '(Default)' : ''}</p>
                      <p className="text-[#525866] mt-1">{a.address_line}, {a.locality}</p>
                      <p className="text-[#525866]">{a.city}, {a.state} - {a.pincode}</p>
                      <p className="mt-1">{a.mobile}</p>
                    </div>
                    <button type="button" onClick={() => deleteAddress(a.id)} className="text-[#525866] hover:text-[#991B1B] self-start cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={addAddress} className="pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs" style={{ borderColor: 'var(--ag-border)' }}>
              <input required placeholder="Full Name" value={addrForm.full_name} onChange={(e) => setAddrForm({ ...addrForm, full_name: e.target.value })} className="border bg-white text-[#111827] px-3 py-2" style={{ borderColor: 'var(--ag-border)' }} />
              <input required placeholder="Mobile" value={addrForm.mobile} onChange={(e) => setAddrForm({ ...addrForm, mobile: e.target.value })} className="border bg-white text-[#111827] px-3 py-2" style={{ borderColor: 'var(--ag-border)' }} />
              <input required placeholder="Address Line" value={addrForm.address_line} onChange={(e) => setAddrForm({ ...addrForm, address_line: e.target.value })} className="sm:col-span-2 border bg-white text-[#111827] px-3 py-2" style={{ borderColor: 'var(--ag-border)' }} />
              <input required placeholder="Locality" value={addrForm.locality} onChange={(e) => setAddrForm({ ...addrForm, locality: e.target.value })} className="border bg-white text-[#111827] px-3 py-2" style={{ borderColor: 'var(--ag-border)' }} />
              <input required placeholder="PIN Code" maxLength={6} value={addrForm.pincode} onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })} className="border bg-white text-[#111827] px-3 py-2" style={{ borderColor: 'var(--ag-border)' }} />
              <button type="submit" className="sm:col-span-2 py-2.5 font-medium cursor-pointer ag-btn-primary">
                Add New Address
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MyOrdersPage() {
  const { user } = useStore();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiFetch<{ orders: OrderRecord[] }>('/api/orders')
      .then((r) => setOrders(r.orders))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-sm" style={{ color: 'var(--ag-muted)' }}>Sign in to view your order history.</p>
        <Link to="/login" className="mt-4 inline-block px-6 py-2.5 text-xs ag-btn-primary">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="ag-heading text-2xl sm:text-3xl font-semibold pb-5 border-b" style={{ borderColor: 'var(--ag-border)' }}>
        My Orders
      </h1>
      {loading ? (
        <p className="py-10 text-sm" style={{ color: 'var(--ag-muted)' }}>Loading orders...</p>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm" style={{ color: 'var(--ag-muted)' }}>You have not placed any orders yet.</p>
          <Link to="/products" className="mt-4 inline-block px-6 py-2.5 text-xs ag-btn-primary">Shop Catalog</Link>
        </div>
      ) : (
        <div className="pt-6 space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="ag-store-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-semibold">{o.order_number}</p>
                  <span className={`px-2 py-0.5 text-[11px] border ${paymentStatusBadgeClass(o.payment_status)}`}>
                    {paymentStatusLabel(o.payment_status)}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--ag-muted)' }}>
                  {new Date(o.created_at).toLocaleDateString('en-IN')} · {o.order_status} · {paymentMethodLabel(o.payment_method)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold tabular-nums">{formatINR(o.grand_total)}</span>
                <Link to={`/orders/${o.id}`} className="px-4 py-2 text-xs font-medium ag-btn-secondary">
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderDetailPage() {
  const { id } = useParams();
  const { notify } = useStore();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const load = () => {
    if (!id) return;
    apiFetch<{ order: OrderRecord }>(`/api/orders/${id}`).then((r) => setOrder(r.order)).catch(() => {});
  };

  useEffect(load, [id]);

  if (!order) return <div className="max-w-4xl mx-auto px-4 py-16 text-sm" style={{ color: 'var(--ag-muted)' }}>Loading order...</div>;

  const requestCancel = async () => {
    try {
      await apiFetch(`/api/orders/${order.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Customer requested cancellation' }) });
      notify('Cancellation request submitted');
      load();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/orders/${order.id}/return`, { method: 'POST', body: JSON.stringify({ reason: returnReason }) });
      notify('Return request submitted');
      setShowReturn(false);
      load();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--ag-border)' }}>
        <div>
          <p className="text-xs" style={{ color: 'var(--ag-muted)' }}>
            {order.is_proforma ? 'Proforma Summary' : 'Retail Invoice'} {order.invoice_number}
          </p>
          <h1 className="ag-heading text-2xl sm:text-3xl font-semibold">Order {order.order_number}</h1>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button
            type="button"
            disabled={downloadingPdf}
            onClick={async () => {
              setDownloadingPdf(true);
              try {
                await downloadInvoicePdf(
                  order.id,
                  undefined,
                  order.is_proforma ? `PROFORMA-${order.order_number}` : order.invoice_number
                );
              } catch (err: any) {
                notify(err.message || 'Could not download invoice PDF', 'error');
              } finally {
                setDownloadingPdf(false);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium ag-btn-primary cursor-pointer disabled:opacity-50"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>{downloadingPdf ? 'Preparing PDF...' : order.is_proforma ? 'Download Proforma PDF' : 'Download Invoice PDF'}</span>
          </button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium cursor-pointer ag-btn-secondary">
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      <div className="ag-store-card p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div><p style={{ color: 'var(--ag-muted)' }}>Order Status</p><p className="font-semibold mt-0.5">{order.order_status}</p></div>
          <div>
            <p style={{ color: 'var(--ag-muted)' }}>Payment</p>
            <p className="font-semibold mt-0.5">{paymentMethodLabel(order.payment_method)}</p>
            <span className={`mt-1 inline-block px-2 py-0.5 text-[11px] border ${paymentStatusBadgeClass(order.payment_status)}`}>
              {paymentStatusLabel(order.payment_status)}
            </span>
          </div>
          <div><p style={{ color: 'var(--ag-muted)' }}>Source</p><p className="font-semibold mt-0.5">{order.order_source}</p></div>
          <div><p style={{ color: 'var(--ag-muted)' }}>Total</p><p className="font-semibold tabular-nums mt-0.5">{formatINR(order.grand_total)}</p></div>
        </div>

        <div className="pt-4 border-t divide-y" style={{ borderColor: 'var(--ag-border)' }}>
          {order.items?.map((it) => (
            <div key={it.id} className="py-3 flex justify-between text-sm">
              <div>
                <p className="font-medium">{it.product_title}</p>
                <p className="text-xs" style={{ color: 'var(--ag-muted)' }}>SKU: {it.sku} · {it.size} / {it.color} × {it.quantity}</p>
              </div>
              <span className="tabular-nums font-medium">{formatINR(it.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t space-y-1.5 text-xs tabular-nums" style={{ borderColor: 'var(--ag-border)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--ag-muted)' }}>Items Subtotal</span>
            <span>{formatINR(order.subtotal)}</span>
          </div>
          {Number(order.discount_amount || 0) > 0 && (
            <div className="flex justify-between text-[#15803D]">
              <span>Discount</span>
              <span>− {formatINR(order.discount_amount)}</span>
            </div>
          )}
          {order.gst_breakdown?.gst_enabled && Number(order.tax_amount || 0) > 0 && (
            <>
              <div className="flex justify-between">
                <span style={{ color: 'var(--ag-muted)' }}>Taxable Value</span>
                <span>{formatINR(order.taxable_amount || 0)}</span>
              </div>
              {Number(order.cgst_amount || 0) > 0 || Number(order.sgst_amount || 0) > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--ag-muted)' }}>CGST</span>
                    <span>{formatINR(order.cgst_amount || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--ag-muted)' }}>SGST</span>
                    <span>{formatINR(order.sgst_amount || 0)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span style={{ color: 'var(--ag-muted)' }}>IGST</span>
                  <span>{formatINR(order.igst_amount || 0)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between">
            <span style={{ color: 'var(--ag-muted)' }}>Shipping</span>
            <span>{Number(order.shipping_fee || 0) === 0 ? 'Free' : formatINR(order.shipping_fee)}</span>
          </div>
          <div className="flex justify-between font-bold text-sm pt-1.5 border-t" style={{ borderColor: 'var(--ag-border)' }}>
            <span>Grand Total</span>
            <span>{formatINR(order.grand_total)}</span>
          </div>
        </div>

        <div className="pt-4 border-t flex flex-wrap gap-3 no-print" style={{ borderColor: 'var(--ag-border)' }}>
          {['Pending Confirmation', 'Confirmed', 'Processing'].includes(order.order_status) && (
            <button type="button" onClick={requestCancel} className="px-4 py-2 border border-[#991B1B] text-[#991B1B] text-xs font-medium cursor-pointer">
              Request Cancellation
            </button>
          )}
          {order.order_status === 'Delivered' && (
            <button type="button" onClick={() => setShowReturn((s) => !s)} className="px-4 py-2 text-xs font-medium cursor-pointer ag-btn-secondary">
              Request Return
            </button>
          )}
        </div>

        {showReturn && (
          <form onSubmit={submitReturn} className="pt-3 space-y-3">
            <textarea
              required
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Reason for return or size exchange..."
              className="w-full border bg-white text-[#111827] p-2.5 text-sm"
              style={{ borderColor: 'var(--ag-border)' }}
            />
            <button type="submit" className="px-5 py-2 text-xs font-medium cursor-pointer ag-btn-primary">
              Submit Return Request
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function WishlistPage() {
  const { user } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiFetch<{ products: Product[] }>('/api/wishlist')
      .then((r) => setProducts(r.products))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="ag-heading text-2xl sm:text-3xl font-semibold pb-5 border-b" style={{ borderColor: 'var(--ag-border)' }}>
        Saved Wishlist
      </h1>
      {!user ? (
        <div className="py-16 text-center">
          <p className="text-sm" style={{ color: 'var(--ag-muted)' }}>Sign in to view and sync your saved garments.</p>
          <Link to="/login" className="mt-4 inline-block px-6 py-2.5 text-xs ag-btn-primary">Sign In</Link>
        </div>
      ) : loading ? (
        <p className="py-10 text-sm" style={{ color: 'var(--ag-muted)' }}>Loading wishlist...</p>
      ) : products.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm" style={{ color: 'var(--ag-muted)' }}>Your wishlist is empty.</p>
          <Link to="/products" className="mt-4 inline-block px-6 py-2.5 text-xs ag-btn-primary">Browse Catalog</Link>
        </div>
      ) : (
        <div className="pt-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
