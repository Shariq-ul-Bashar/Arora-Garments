import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, setAuthToken } from '../lib/api';
import { signOutFirebase, testConnection } from '../lib/firebase';
import { applyThemeVariables } from '../lib/themes';
import type {
  AppearanceSettings,
  AuthUser,
  BrandingSettings,
  BusinessInfo,
  BuyNowSelection,
  CartItem,
  Category,
  Collection,
  DeliveryZone,
  HeroBanner,
  HomepageSection,
  InvoiceSettings,
  PaymentSettings,
  Product,
} from '../types';

export interface BootstrapData {
  business_info: BusinessInfo;
  invoice_settings: InvoiceSettings;
  branding: BrandingSettings;
  appearance: AppearanceSettings;
  payment_settings: PaymentSettings;
  categories: Category[];
  collections: Collection[];
  homepage_sections: HomepageSection[];
  banners: HeroBanner[];
  shipping_methods: Array<{ id: string; name: string; description?: string; base_fee: number; estimated_time: string }>;
  serviceable_zones: DeliveryZone[];
  integrations: {
    cod_enabled: boolean;
    upi_whatsapp_enabled: boolean;
  };
}

interface ToastMessage {
  id: number;
  text: string;
  type: 'info' | 'error';
}

interface StoreContextValue {
  loading: boolean;
  bootstrap: BootstrapData | null;
  user: AuthUser | null;
  cart: { items: CartItem[]; subtotal: number; item_count: number };
  buyNowItem: BuyNowSelection | null;
  setBuyNowItem: (item: BuyNowSelection | null) => void;
  wishlistIds: Set<string>;
  recentlyViewed: Product[];
  refreshBootstrap: () => Promise<void>;
  refreshAuth: () => Promise<AuthUser | null>;
  refreshCart: () => Promise<void>;
  addToCart: (variantId: string, quantity?: number) => Promise<void>;
  updateCartQty: (variantId: string, quantity: number) => Promise<void>;
  removeFromCart: (variantId: string) => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  addRecentlyViewed: (product: Product) => void;
  logout: () => Promise<void>;
  notify: (text: string, type?: 'info' | 'error') => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const BUY_NOW_STORAGE_KEY = 'ag_buy_now_item';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cart, setCart] = useState<{ items: CartItem[]; subtotal: number; item_count: number }>({
    items: [],
    subtotal: 0,
    item_count: 0,
  });
  const [buyNowItem, setBuyNowItemState] = useState<BuyNowSelection | null>(() => {
    try {
      const raw = sessionStorage.getItem(BUY_NOW_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>(() => {
    try {
      const raw = localStorage.getItem('ag_recently_viewed');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const setBuyNowItem = useCallback((item: BuyNowSelection | null) => {
    setBuyNowItemState(item);
    try {
      if (item) {
        sessionStorage.setItem(BUY_NOW_STORAGE_KEY, JSON.stringify(item));
      } else {
        sessionStorage.removeItem(BUY_NOW_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const notify = useCallback((text: string, type: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    const data = await apiFetch<BootstrapData>('/api/store/bootstrap');
    setBootstrap(data);
  }, []);

  const refreshCart = useCallback(async () => {
    const data = await apiFetch<{ items: CartItem[]; subtotal: number; item_count: number }>('/api/cart');
    setCart(data);
  }, []);

  const refreshWishlist = useCallback(async (u: AuthUser | null) => {
    if (!u) {
      setWishlistIds(new Set());
      return;
    }
    try {
      const data = await apiFetch<{ products: Product[] }>('/api/wishlist');
      setWishlistIds(new Set(data.products.map((p) => p.id)));
    } catch {
      setWishlistIds(new Set());
    }
  }, []);

  const refreshAuth = useCallback(async (): Promise<AuthUser | null> => {
    const data = await apiFetch<{ user: AuthUser | null }>('/api/auth/me');
    setUser(data.user);
    await refreshWishlist(data.user);
    return data.user;
  }, [refreshWishlist]);

  useEffect(() => {
    applyThemeVariables(bootstrap?.appearance);
  }, [bootstrap?.appearance]);

  useEffect(() => {
    if (bootstrap?.branding?.favicon_url) {
      const el = document.getElementById('ag-favicon') as HTMLLinkElement | null;
      if (el) {
        el.href = bootstrap.branding.favicon_url;
      }
    }
  }, [bootstrap?.branding?.favicon_url]);

  useEffect(() => {
    testConnection().catch(() => {});
    (async () => {
      try {
        await Promise.all([refreshBootstrap(), refreshAuth(), refreshCart()]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshBootstrap, refreshAuth, refreshCart]);

  const addToCart = useCallback(
    async (variantId: string, quantity = 1) => {
      const data = await apiFetch<{ items: CartItem[]; subtotal: number; item_count: number }>('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ variant_id: variantId, quantity }),
      });
      setCart(data);
      notify('Added to shopping bag');
    },
    [notify]
  );

  const updateCartQty = useCallback(async (variantId: string, quantity: number) => {
    const data = await apiFetch<{ items: CartItem[]; subtotal: number; item_count: number }>(`/api/cart/${variantId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
    setCart(data);
  }, []);

  const removeFromCart = useCallback(
    async (variantId: string) => {
      const data = await apiFetch<{ items: CartItem[]; subtotal: number; item_count: number }>(`/api/cart/${variantId}`, {
        method: 'DELETE',
      });
      setCart(data);
      notify('Removed from bag');
    },
    [notify]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!user) {
        notify('Sign in to save items to your wishlist', 'error');
        return;
      }
      if (wishlistIds.has(productId)) {
        await apiFetch(`/api/wishlist/${productId}`, { method: 'DELETE' });
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        notify('Removed from wishlist');
      } else {
        await apiFetch(`/api/wishlist/${productId}`, { method: 'POST' });
        setWishlistIds((prev) => new Set(prev).add(productId));
        notify('Saved to wishlist');
      }
    },
    [user, wishlistIds, notify]
  );

  const addRecentlyViewed = useCallback((product: Product) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((p) => p.id !== product.id);
      const next = [product, ...filtered].slice(0, 6);
      try {
        localStorage.setItem('ag_recently_viewed', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAuthToken(null);
    await signOutFirebase();
    setUser(null);
    setWishlistIds(new Set());
    await refreshCart();
    notify('Signed out');
  }, [refreshCart, notify]);

  return (
    <StoreContext.Provider
      value={{
        loading,
        bootstrap,
        user,
        cart,
        buyNowItem,
        setBuyNowItem,
        wishlistIds,
        recentlyViewed,
        refreshBootstrap,
        refreshAuth,
        refreshCart,
        addToCart,
        updateCartQty,
        removeFromCart,
        toggleWishlist,
        addRecentlyViewed,
        logout,
        notify,
      }}
    >
      {children}
      {/* Clean non-intrusive toast stack */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2.5 text-sm font-medium shadow-md border ${
              toast.type === 'error'
                ? 'bg-[#7F1D1D] text-white border-[#991B1B]'
                : 'bg-[#111827] text-white border-[#374151]'
            }`}
            style={{ borderRadius: 'var(--ag-btn-radius)' }}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
