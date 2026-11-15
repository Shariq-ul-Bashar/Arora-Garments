import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  MapPin,
  Plus,
  QrCode,
  ReceiptIndianRupee,
  Trash2,
  Upload,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { apiFetch, DEPARTMENT_LABELS, formatINR } from '../../lib/api';

const INDIAN_STATES = [
  'Uttar Pradesh',
  'Delhi',
  'Haryana',
  'Rajasthan',
  'Uttarakhand',
  'Madhya Pradesh',
  'Maharashtra',
  'Gujarat',
  'Punjab',
  'Bihar',
  'West Bengal',
  'Karnataka',
  'Tamil Nadu',
  'Telangana',
  'Andhra Pradesh',
  'Kerala',
  'Odisha',
  'Assam',
  'Jharkhand',
  'Chhattisgarh',
  'Himachal Pradesh',
  'Jammu & Kashmir',
  'Goa',
  'Chandigarh',
];

export function AdminCategoriesPage() {
  const { notify, refreshBootstrap } = useStore();
  const [categories, setCategories] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [newCat, setNewCat] = useState({ name: '', slug: '', department: 'mens-wear', parent_id: '', sort_order: 1, image_url: '' });
  const [newCoupon, setNewCoupon] = useState({ code: '', discount_type: 'percentage', discount_value: 10, min_order_amount: 500 });

  const load = () => {
    apiFetch<{ categories: any[] }>('/api/admin/categories').then((r) => setCategories(r.categories));
    apiFetch<{ coupons: any[] }>('/api/admin/coupons').then((r) => setCoupons(r.coupons));
  };

  useEffect(load, []);

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = newCat.slug || `${newCat.department}-${newCat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    await apiFetch('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ ...newCat, slug, parent_id: newCat.parent_id || null, image_url: newCat.image_url || undefined }),
    });
    setNewCat({ name: '', slug: '', department: 'mens-wear', parent_id: '', sort_order: 1, image_url: '' });
    notify('Category added');
    refreshBootstrap();
    load();
  };

  const toggleCategoryActive = async (c: any) => {
    await apiFetch(`/api/admin/categories/${c.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: c.name,
        slug: c.slug,
        department: c.department,
        parent_id: c.parent_id,
        sort_order: c.sort_order,
        is_active: !c.is_active,
        image_url: c.image_url || null,
      }),
    });
    notify(`Category ${c.is_active ? 'hidden' : 'activated'}`);
    refreshBootstrap();
    load();
  };

  const uploadCategoryImage = async (c: any, file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    fd.append('bucket', 'catalog');
    try {
      const res = await apiFetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: fd });
      await apiFetch(`/api/admin/categories/${c.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: c.name,
          slug: c.slug,
          department: c.department,
          parent_id: c.parent_id,
          sort_order: c.sort_order,
          is_active: Boolean(c.is_active),
          image_url: res.url,
        }),
      });
      notify(`Updated cover image for "${c.name}"`);
      refreshBootstrap();
      load();
    } catch (err: any) {
      notify(err.message || 'Image upload failed', 'error');
    }
  };

  const deleteCategory = async (id: string) => {
    await apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
    notify('Category deleted');
    refreshBootstrap();
    load();
  };

  const addCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/coupons', { method: 'POST', body: JSON.stringify(newCoupon) });
    setNewCoupon({ code: '', discount_type: 'percentage', discount_value: 10, min_order_amount: 500 });
    notify('Coupon created');
    load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Categories, Subcategories &amp; Coupons</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage store departments, subcategories, department cover photos, and promotional coupons.</p>
      </div>

      <div className="border border-gray-200 bg-white rounded-md p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Categories &amp; Subcategories</h2>
        <form onSubmit={addCategory} className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          <input required placeholder="Category Name" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2" />
          <select value={newCat.department} onChange={(e) => setNewCat({ ...newCat, department: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2">
            <option value="mens-wear">Men&apos;s Wear</option>
            <option value="womens-wear">Women&apos;s Wear</option>
            <option value="kids-wear">Kids Wear</option>
            <option value="footwear">Footwear</option>
          </select>
          <select value={newCat.parent_id} onChange={(e) => setNewCat({ ...newCat, parent_id: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2">
            <option value="">Top-Level Department</option>
            {categories.filter((c) => !c.parent_id && c.department === newCat.department).map((c) => (
              <option key={c.id} value={c.id}>Under {c.name}</option>
            ))}
          </select>
          <input type="number" placeholder="Order" value={newCat.sort_order} onChange={(e) => setNewCat({ ...newCat, sort_order: Number(e.target.value) })} className="border border-gray-300 rounded px-2.5 py-2" />
          <button type="submit" className="bg-gray-900 text-white rounded font-medium py-2 cursor-pointer">Add Category</button>
        </form>

        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 text-xs">
          {categories.map((c) => (
            <div key={c.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} className="w-10 h-10 object-cover rounded border border-gray-200 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div>
                  <span className="font-semibold text-gray-900">{c.name}</span>
                  <span className="text-gray-500 ml-2">· {DEPARTMENT_LABELS[c.department]} · {c.parent_id ? 'Subcategory' : 'Department'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer text-[11px]">
                  <Upload className="w-3 h-3" />
                  <span>{c.image_url ? 'Change Image' : 'Upload Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      uploadCategoryImage(c, e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button type="button" onClick={() => toggleCategoryActive(c)} className="underline text-gray-600 cursor-pointer">
                  {c.is_active ? 'Active' : 'Hidden'}
                </button>
                <button type="button" onClick={() => deleteCategory(c.id)} className="text-rose-700 cursor-pointer" title="Delete Category">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-gray-200 bg-white rounded-md p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Promotional Coupons</h2>
        <form onSubmit={addCoupon} className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          <input required placeholder="CODE (e.g. ARORA10)" value={newCoupon.code} onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2 uppercase font-mono" />
          <select value={newCoupon.discount_type} onChange={(e) => setNewCoupon({ ...newCoupon, discount_type: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2">
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed (₹)</option>
          </select>
          <input type="number" min={1} placeholder="Value" value={newCoupon.discount_value} onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: Number(e.target.value) })} className="border border-gray-300 rounded px-2.5 py-2" />
          <input type="number" min={0} placeholder="Min Order ₹" value={newCoupon.min_order_amount} onChange={(e) => setNewCoupon({ ...newCoupon, min_order_amount: Number(e.target.value) })} className="border border-gray-300 rounded px-2.5 py-2" />
          <button type="submit" className="bg-gray-900 text-white rounded font-medium py-2 cursor-pointer">Create Coupon</button>
        </form>
        <div className="divide-y divide-gray-100 text-xs">
          {coupons.map((cp) => (
            <div key={cp.id} className="py-2 flex justify-between items-center">
              <span>
                <strong className="font-mono">{cp.code}</strong> — {cp.discount_type === 'percentage' ? `${cp.discount_value}% off` : `₹${cp.discount_value} off`} (Min ₹{cp.min_order_amount})
              </span>
              <button
                type="button"
                onClick={async () => {
                  await apiFetch(`/api/admin/coupons/${cp.id}`, { method: 'DELETE' });
                  load();
                }}
                className="text-rose-700 cursor-pointer"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminCollectionsPage() {
  const { notify, refreshBootstrap } = useStore();
  const [collections, setCollections] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [newCol, setNewCol] = useState({ name: '', slug: '', description: '', banner_image_url: '', sort_order: 1 });
  const [editingCol, setEditingCol] = useState<any | null>(null);
  const [editingMeta, setEditingMeta] = useState<any | null>(null);
  const [selectedProdIds, setSelectedProdIds] = useState<Set<string>>(new Set());

  const load = () => {
    apiFetch<{ collections: any[] }>('/api/admin/collections').then((r) => setCollections(r.collections));
    apiFetch<{ products: any[] }>('/api/admin/products').then((r) => setProducts(r.products));
  };

  useEffect(load, []);

  const uploadBanner = async (file: File | undefined, onSuccess: (url: string) => void) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    fd.append('bucket', 'collections');
    try {
      const res = await apiFetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: fd });
      onSuccess(res.url);
      notify('Collection cover photo uploaded');
    } catch (err: any) {
      notify(err.message || 'Upload failed', 'error');
    }
  };

  const createCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = newCol.slug || newCol.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await apiFetch('/api/admin/collections', {
      method: 'POST',
      body: JSON.stringify({
        ...newCol,
        slug,
        banner_image_url: newCol.banner_image_url || undefined,
      }),
    });
    setNewCol({ name: '', slug: '', description: '', banner_image_url: '', sort_order: 1 });
    notify('Collection created');
    refreshBootstrap();
    load();
  };

  const saveCollectionMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMeta) return;
    await apiFetch(`/api/admin/collections/${editingMeta.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: editingMeta.name,
        slug: editingMeta.slug,
        description: editingMeta.description || '',
        banner_image_url: editingMeta.banner_image_url || '',
        sort_order: Number(editingMeta.sort_order || 0),
        is_active: Boolean(editingMeta.is_active ?? true),
      }),
    });
    notify(`Collection "${editingMeta.name}" updated`);
    setEditingMeta(null);
    refreshBootstrap();
    load();
  };

  const openAssign = (col: any) => {
    setEditingCol(col);
    setSelectedProdIds(new Set(col.product_ids || []));
  };

  const saveAssignedProducts = async () => {
    if (!editingCol) return;
    await apiFetch(`/api/admin/collections/${editingCol.id}/products`, {
      method: 'PUT',
      body: JSON.stringify({ product_ids: Array.from(selectedProdIds) }),
    });
    notify(`Updated products in "${editingCol.name}"`);
    setEditingCol(null);
    refreshBootstrap();
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Curated Collections &amp; Editorial Covers</h1>
        <p className="text-xs text-gray-500 mt-0.5">Group garments and manage collection cover imagery for the storefront.</p>
      </div>

      <form onSubmit={createCollection} className="border border-gray-200 bg-white rounded-md p-4 grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs items-center">
        <input required placeholder="Collection Name" value={newCol.name} onChange={(e) => setNewCol({ ...newCol, name: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2" />
        <input placeholder="slug (optional)" value={newCol.slug} onChange={(e) => setNewCol({ ...newCol, slug: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2 font-mono" />
        <input placeholder="Short description" value={newCol.description} onChange={(e) => setNewCol({ ...newCol, description: e.target.value })} className="sm:col-span-2 border border-gray-300 rounded px-2.5 py-2" />
        <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
          <Upload className="w-3.5 h-3.5" />
          <span>{newCol.banner_image_url ? 'Photo Ready' : 'Upload Cover'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadBanner(e.target.files?.[0], (url) => setNewCol((p) => ({ ...p, banner_image_url: url })))} />
        </label>
        <button type="submit" className="bg-gray-900 text-white rounded font-medium py-2 cursor-pointer">+ Add Collection</button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {collections.map((col) => (
          <div key={col.id} className="border border-gray-200 bg-white rounded-md overflow-hidden flex flex-col justify-between">
            <div className="aspect-[16/9] bg-gray-100 relative overflow-hidden">
              {col.banner_image_url ? (
                <img src={col.banner_image_url} alt={col.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
            </div>
            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <div>
                <p className="font-mono text-[11px] text-gray-400">/{col.slug}</p>
                <h2 className="text-base font-semibold text-gray-900 mt-0.5">{col.name}</h2>
                <p className="text-gray-500 mt-1">{col.description || 'Storefront collection'}</p>
                <p className="mt-2 font-medium text-gray-800">{col.product_ids?.length || 0} assigned product(s)</p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => openAssign(col)} className="underline font-medium text-gray-900 cursor-pointer">
                    Assign Products
                  </button>
                  <button type="button" onClick={() => setEditingMeta({ ...col })} className="underline text-gray-700 cursor-pointer">
                    Edit / Image
                  </button>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/admin/collections/${col.id}`, { method: 'DELETE' });
                    notify('Collection deleted');
                    refreshBootstrap();
                    load();
                  }}
                  className="text-rose-700 cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingMeta && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={saveCollectionMeta} className="bg-white border border-gray-200 rounded-md max-w-lg w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-base font-semibold">Edit Collection &amp; Cover Photo</h2>
              <button type="button" onClick={() => setEditingMeta(null)} className="underline text-gray-500 cursor-pointer">Close</button>
            </div>
            <div>
              <label className="block font-medium mb-1">Collection Name</label>
              <input required value={editingMeta.name} onChange={(e) => setEditingMeta({ ...editingMeta, name: e.target.value })} className="w-full border border-gray-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="block font-medium mb-1">Description</label>
              <textarea rows={2} value={editingMeta.description || ''} onChange={(e) => setEditingMeta({ ...editingMeta, description: e.target.value })} className="w-full border border-gray-300 rounded p-2.5" />
            </div>
            <div className="space-y-2">
              <label className="block font-medium">Cover Photo</label>
              {editingMeta.banner_image_url && (
                <img src={editingMeta.banner_image_url} alt={editingMeta.name} className="w-full h-36 object-cover rounded border border-gray-200" />
              )}
              <div className="flex gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-900 rounded font-medium cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Cover</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => uploadBanner(e.target.files?.[0], (url) => setEditingMeta((m: any) => ({ ...m, banner_image_url: url })))}
                  />
                </label>
                <input
                  value={editingMeta.banner_image_url || ''}
                  onChange={(e) => setEditingMeta({ ...editingMeta, banner_image_url: e.target.value })}
                  placeholder="/assets/catalog/... or /uploads/..."
                  className="flex-1 border border-gray-300 rounded px-2.5 py-2 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
              <button type="button" onClick={() => setEditingMeta(null)} className="px-4 py-2 border border-gray-300 rounded cursor-pointer">Cancel</button>
              <button type="submit" className="px-5 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {editingCol && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-md max-w-xl w-full max-h-[80vh] flex flex-col p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-base font-semibold">Assign Products to &ldquo;{editingCol.name}&rdquo;</h2>
              <button type="button" onClick={() => setEditingCol(null)} className="underline text-gray-500 cursor-pointer">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {products.map((p) => (
                <label key={p.id} className="py-2 flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="font-medium text-gray-900">{p.title}</p>
                    <p className="text-gray-500 font-mono">{p.sku_prefix} · {p.is_published ? 'Live' : 'Draft'}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedProdIds.has(p.id)}
                    onChange={(e) => {
                      const next = new Set(selectedProdIds);
                      e.target.checked ? next.add(p.id) : next.delete(p.id);
                      setSelectedProdIds(next);
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
              <button type="button" onClick={() => setEditingCol(null)} className="px-4 py-2 border border-gray-300 rounded cursor-pointer">Cancel</button>
              <button type="button" onClick={saveAssignedProducts} className="px-5 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer">
                Save Collection Products
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminSettingsPage() {
  const { notify, refreshBootstrap } = useStore();
  const [cms, setCms] = useState<any>(null);
  const [slideDraft, setSlideDraft] = useState<any | null>(null);
  const [slideDragOver, setSlideDragOver] = useState(false);

  const load = () => {
    apiFetch('/api/admin/cms').then(setCms);
  };
  useEffect(load, []);

  if (!cms) return <div className="text-sm text-gray-600">Loading store settings &amp; CMS...</div>;

  const paymentSettings = cms.settings.payment_settings || {
    cod_enabled: true,
    upi_whatsapp_enabled: true,
    upi_id: 'aroragarments@upi',
    upi_payee_name: 'ARORA GARMENTS',
    upi_qr_url: '',
    upi_instructions: 'Scan our official QR or pay to our UPI ID, then share your screenshot and Order ID on WhatsApp for manual verification.',
  };

  const invSettings = {
    gst_enabled: false,
    legal_name: '',
    gstin: '',
    seller_state: 'Uttar Pradesh',
    default_gst_rate: 0,
    tax_calculation_mode: 'inclusive',
    tax_label: 'GST',
    tax_rate_percent: 0,
    return_window_days: 7,
    footer_note: 'Thank you for shopping at ARORA GARMENTS, Bulandshahr.',
    ...(cms.settings.invoice_settings || {}),
  };

  const businessInfo = cms.settings.business_info || {};
  const heroBanners = (cms.banners || [])
    .filter((b: any) => !b.placement || b.placement === 'hero')
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const setPayField = (key: string, val: any) => {
    setCms({
      ...cms,
      settings: {
        ...cms.settings,
        payment_settings: { ...paymentSettings, [key]: val },
      },
    });
  };

  const setInvField = (key: string, val: any) => {
    const nextInv = { ...invSettings, [key]: val };
    if (key === 'default_gst_rate') {
      nextInv.tax_rate_percent = Number(val) || 0;
    }
    setCms({
      ...cms,
      settings: {
        ...cms.settings,
        invoice_settings: nextInv,
      },
    });
  };

  const uploadQrImage = async (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    fd.append('bucket', 'payments');
    try {
      const res = await apiFetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: fd });
      setPayField('upi_qr_url', res.url);
      notify('Official UPI QR code uploaded — click Save Payment Settings to publish');
    } catch (err: any) {
      notify(err.message || 'QR upload failed', 'error');
    }
  };

  const uploadSlideImage = async (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    fd.append('bucket', 'banners');
    try {
      const res = await apiFetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: fd });
      setSlideDraft((prev: any) => ({ ...prev, image_url: res.url }));
      notify('Hero slide photo uploaded');
    } catch (err: any) {
      notify(err.message || 'Slide upload failed', 'error');
    }
  };

  const saveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideDraft) return;
    if (!slideDraft.image_url?.trim()) {
      notify('Please upload a slide image or paste an image path', 'error');
      return;
    }
    const payload = {
      title: slideDraft.title || 'Arora Garments',
      subtitle: slideDraft.subtitle || '',
      image_url: slideDraft.image_url.trim(),
      cta_label: slideDraft.cta_label || 'Explore Collection',
      cta_link: slideDraft.cta_link || '/shop',
      placement: 'hero',
      sort_order: Number(slideDraft.sort_order ?? heroBanners.length + 1),
      duration_seconds: Math.min(30, Math.max(3, Number(slideDraft.duration_seconds || 8))),
      is_active: Boolean(slideDraft.is_active ?? true),
    };
    try {
      if (slideDraft.id) {
        await apiFetch(`/api/admin/banners/${slideDraft.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        notify('Hero slide updated');
      } else {
        await apiFetch('/api/admin/banners', { method: 'POST', body: JSON.stringify(payload) });
        notify('Hero slide added');
      }
      setSlideDraft(null);
      refreshBootstrap();
      load();
    } catch (err: any) {
      notify(err.message || 'Could not save hero slide', 'error');
    }
  };

  const moveSlide = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= heroBanners.length) return;
    const reordered = [...heroBanners];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await apiFetch('/api/admin/banners/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ ids: reordered.map((b: any) => b.id) }),
      });
      notify('Hero slide order updated');
      refreshBootstrap();
      load();
    } catch (err: any) {
      notify(err.message || 'Reorder failed', 'error');
    }
  };

  const toggleSlideActive = async (b: any) => {
    await apiFetch(`/api/admin/banners/${b.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: b.title,
        subtitle: b.subtitle || '',
        image_url: b.image_url,
        cta_label: b.cta_label || 'Explore Collection',
        cta_link: b.cta_link || '/shop',
        placement: b.placement || 'hero',
        sort_order: b.sort_order ?? 1,
        duration_seconds: b.duration_seconds ?? 8,
        is_active: !b.is_active,
      }),
    });
    notify(b.is_active ? 'Slide hidden from homepage' : 'Slide activated on homepage');
    refreshBootstrap();
    load();
  };

  const deleteSlide = async (id: string) => {
    await apiFetch(`/api/admin/banners/${id}`, { method: 'DELETE' });
    notify('Hero slide deleted');
    refreshBootstrap();
    load();
  };

  const saveSection = async (sec: any) => {
    await apiFetch(`/api/admin/homepage-sections/${sec.id}`, {
      method: 'PUT',
      body: JSON.stringify(sec),
    });
    notify(`Section "${sec.title}" updated`);
    refreshBootstrap();
    load();
  };

  const saveSetting = async (key: string, val: any, label: string) => {
    await apiFetch(`/api/admin/settings/${key}`, { method: 'PUT', body: JSON.stringify(val) });
    notify(`${label} saved`);
    refreshBootstrap();
  };

  const gstWarningMissing =
    Boolean(invSettings.gst_enabled) && (!String(invSettings.gstin || '').trim() || !String(invSettings.legal_name || '').trim());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Store Settings, Hero Slider, GST &amp; UPI QR</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage homepage hero slider banners, GST &amp; invoice tax rules, Google Maps location, official UPI QR, and section order.
        </p>
      </div>

      {/* Homepage Hero Image Slider Manager */}
      <div className="border border-gray-200 bg-white rounded-md p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-900" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Homepage Hero Image Slider</h2>
              <p className="text-[11px] text-gray-500">
                Slides advance automatically on the homepage according to each slide&apos;s duration (3–30s) with pause-on-hover and mobile swipe/tap controls.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setSlideDraft({
                id: null,
                title: '',
                subtitle: '',
                image_url: '',
                cta_label: 'Shop Collection',
                cta_link: '/shop',
                duration_seconds: 8,
                sort_order: heroBanners.length + 1,
                is_active: true,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer hover:bg-gray-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Hero Slide</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {heroBanners.length === 0 ? (
            <p className="text-gray-500 py-4 text-center">No hero slides configured. Add a slide above to display a homepage hero banner.</p>
          ) : (
            heroBanners.map((b: any, idx: number) => (
              <div key={b.id} className="border border-gray-200 rounded-md p-3 flex flex-wrap items-center justify-between gap-4 bg-gray-50/40">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-gray-900 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <img src={b.image_url} alt={b.title} className="w-24 h-14 object-cover rounded border border-gray-200 shrink-0 bg-gray-100" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{b.title}</p>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          b.is_active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {b.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </div>
                    <p className="text-gray-500 truncate max-w-md">{b.subtitle || 'No subtitle'}</p>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                      Button: &ldquo;{b.cta_label || 'Explore Collection'}&rdquo; → {b.cta_link || '/shop'} · {b.duration_seconds || 8}s
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveSlide(idx, -1)}
                    className="p-1.5 border border-gray-300 bg-white rounded hover:bg-gray-50 disabled:opacity-35 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === heroBanners.length - 1}
                    onClick={() => moveSlide(idx, 1)}
                    className="p-1.5 border border-gray-300 bg-white rounded hover:bg-gray-50 disabled:opacity-35 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSlideActive(b)}
                    className="px-2.5 py-1.5 border border-gray-300 bg-white rounded hover:bg-gray-50 cursor-pointer"
                  >
                    {b.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlideDraft({ ...b })}
                    className="px-2.5 py-1.5 border border-gray-900 bg-white text-gray-900 rounded font-medium hover:bg-gray-50 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSlide(b.id)}
                    className="p-1.5 border border-rose-200 text-rose-700 bg-white rounded hover:bg-rose-50 cursor-pointer"
                    title="Delete Slide"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {slideDraft && (
          <form onSubmit={saveSlide} className="border border-gray-900 rounded-md p-4 bg-white space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
              <h3 className="text-sm font-semibold text-gray-900">{slideDraft.id ? 'Edit Hero Slide' : 'New Hero Slide'}</h3>
              <button type="button" onClick={() => setSlideDraft(null)} className="underline text-gray-600 cursor-pointer">
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              <div className="md:col-span-5 space-y-2">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSlideDragOver(true);
                  }}
                  onDragLeave={() => setSlideDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setSlideDragOver(false);
                    uploadSlideImage(e.dataTransfer.files?.[0]);
                  }}
                  className={`border-2 border-dashed rounded-md p-3 text-center ${
                    slideDragOver ? 'border-gray-900 bg-gray-100' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  {slideDraft.image_url ? (
                    <img src={slideDraft.image_url} alt="Slide preview" className="w-full h-36 object-cover rounded mb-2 border border-gray-200" />
                  ) : (
                    <div className="py-6 text-gray-400">
                      <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                      <p>Drop wide hero image here (16:9 recommended)</p>
                    </div>
                  )}
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded font-medium cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{slideDraft.image_url ? 'Replace Slide Image' : 'Upload Slide Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        uploadSlideImage(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <input
                  value={slideDraft.image_url || ''}
                  onChange={(e) => setSlideDraft({ ...slideDraft, image_url: e.target.value })}
                  placeholder="Or paste image path (/assets/catalog/...)"
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 font-mono"
                />
              </div>

              <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">Slide Headline *</label>
                  <input
                    required
                    placeholder="e.g. Tailored Formals & Wedding Craft"
                    value={slideDraft.title}
                    onChange={(e) => setSlideDraft({ ...slideDraft, title: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2.5 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">Slide Subtitle</label>
                  <input
                    placeholder="Short seasonal or showroom highlight"
                    value={slideDraft.subtitle || ''}
                    onChange={(e) => setSlideDraft({ ...slideDraft, subtitle: e.target.value })}
                    className="w-full border border-gray-300 rounded px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">CTA Button Label</label>
                  <input
                    value={slideDraft.cta_label || ''}
                    onChange={(e) => setSlideDraft({ ...slideDraft, cta_label: e.target.value })}
                    placeholder="Explore Collection"
                    className="w-full border border-gray-300 rounded px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Link Destination</label>
                  <input
                    value={slideDraft.cta_link || ''}
                    onChange={(e) => setSlideDraft({ ...slideDraft, cta_link: e.target.value })}
                    placeholder="/shop/mens-wear"
                    className="w-full border border-gray-300 rounded px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Auto-Slide Duration (Seconds, 3–30)</label>
                  <input
                    type="number"
                    min={3}
                    max={30}
                    value={slideDraft.duration_seconds ?? 8}
                    onChange={(e) => setSlideDraft({ ...slideDraft, duration_seconds: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded px-2.5 py-2 tabular-nums"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(slideDraft.is_active ?? true)}
                      onChange={(e) => setSlideDraft({ ...slideDraft, is_active: e.target.checked })}
                    />
                    <span>Show Slide on Homepage</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <button type="button" onClick={() => setSlideDraft(null)} className="px-4 py-2 border border-gray-300 rounded cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer">
                {slideDraft.id ? 'Update Slide' : 'Publish Hero Slide'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Payment & Official UPI QR Settings */}
      <div className="border border-gray-200 bg-white rounded-md p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-gray-900" />
            <h2 className="text-sm font-semibold text-gray-900">Checkout Payment Methods &amp; Official UPI QR Code</h2>
          </div>
          <button
            type="button"
            onClick={() => saveSetting('payment_settings', paymentSettings, 'Payment & UPI settings')}
            className="px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer"
          >
            Save Payment Settings
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap gap-6 py-1">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={Boolean(paymentSettings.cod_enabled ?? true)}
                  onChange={(e) => setPayField('cod_enabled', e.target.checked)}
                />
                <span>Enable Cash on Delivery (COD)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={Boolean(paymentSettings.upi_whatsapp_enabled ?? true)}
                  onChange={(e) => setPayField('upi_whatsapp_enabled', e.target.checked)}
                />
                <span>Enable UPI / Pay via WhatsApp</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-600 mb-1">Official Store UPI ID</label>
                <input
                  value={paymentSettings.upi_id || ''}
                  onChange={(e) => setPayField('upi_id', e.target.value)}
                  placeholder="aroragarments@upi"
                  className="w-full border border-gray-300 rounded px-2.5 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block text-gray-600 mb-1">Payee / Merchant Name</label>
                <input
                  value={paymentSettings.upi_payee_name || ''}
                  onChange={(e) => setPayField('upi_payee_name', e.target.value)}
                  placeholder="ARORA GARMENTS"
                  className="w-full border border-gray-300 rounded px-2.5 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-600 mb-1">Customer Checkout Instructions</label>
              <textarea
                rows={3}
                value={paymentSettings.upi_instructions || ''}
                onChange={(e) => setPayField('upi_instructions', e.target.value)}
                className="w-full border border-gray-300 rounded p-2.5"
              />
            </div>

            <div>
              <label className="block text-gray-600 mb-1">UPI QR Image URL or Upload</label>
              <div className="flex gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-900 rounded font-medium cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload QR Image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadQrImage(e.target.files?.[0])} />
                </label>
                <input
                  value={paymentSettings.upi_qr_url || ''}
                  onChange={(e) => setPayField('upi_qr_url', e.target.value)}
                  placeholder="/uploads/upi-qr.png"
                  className="flex-1 border border-gray-300 rounded px-2.5 py-2 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 border border-gray-200 rounded bg-gray-50 p-4 flex flex-col items-center justify-center text-center space-y-2">
            {paymentSettings.upi_qr_url ? (
              <>
                <img src={paymentSettings.upi_qr_url} alt="Official Store UPI QR Code" className="w-44 h-44 object-contain bg-white border border-gray-200 p-2 rounded" />
                <a href={paymentSettings.upi_qr_url} download className="underline text-gray-700 font-medium">
                  Download Current QR Image
                </a>
              </>
            ) : (
              <div className="py-6 space-y-1 text-gray-500">
                <QrCode className="w-10 h-10 mx-auto text-gray-400" />
                <p className="font-medium text-gray-700">Dynamic UPI QR Ready</p>
                <p className="text-[11px] max-w-xs">
                  Upload your store merchant QR image above, or checkout will display your verified UPI ID ({paymentSettings.upi_id || 'configure above'}) for instant payment.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Business & GST/Invoice Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-gray-200 bg-white rounded-md p-5 space-y-3 text-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <MapPin className="w-4 h-4 text-gray-900" />
            <h2 className="text-sm font-semibold text-gray-900">Official Business Information &amp; Google Maps Link</h2>
          </div>
          {['brand_name', 'tagline', 'address_line', 'primary_phone', 'secondary_phone', 'operating_hours', 'announcement_text'].map((field) => (
            <div key={field}>
              <label className="block capitalize text-gray-600 mb-1">{field.replace(/_/g, ' ')}</label>
              <input
                value={businessInfo[field] || ''}
                onChange={(e) =>
                  setCms({
                    ...cms,
                    settings: {
                      ...cms.settings,
                      business_info: { ...businessInfo, [field]: e.target.value },
                    },
                  })
                }
                className="w-full border border-gray-300 rounded px-2.5 py-1.5"
              />
            </div>
          ))}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-600">Google Maps Store Location Share URL</label>
              {businessInfo.maps_directions_url && (
                <a
                  href={businessInfo.maps_directions_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline text-gray-700 font-medium"
                >
                  <span>Test Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <input
              value={businessInfo.maps_directions_url || ''}
              onChange={(e) =>
                setCms({
                  ...cms,
                  settings: {
                    ...cms.settings,
                    business_info: { ...businessInfo, maps_directions_url: e.target.value },
                  },
                })
              }
              placeholder="https://share.google/kfXnT0m9qZV5sQpdK"
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 font-mono"
            />
          </div>
          <button type="button" onClick={() => saveSetting('business_info', cms.settings.business_info, 'Business information')} className="px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer">
            Save Business Info
          </button>
        </div>

        <div className="border border-gray-200 bg-white rounded-md p-5 space-y-3.5 text-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <ReceiptIndianRupee className="w-4 h-4 text-gray-900" />
            <h2 className="text-sm font-semibold text-gray-900">GST Configuration, Tax Calculation &amp; Invoices</h2>
          </div>

          <label className="flex items-center justify-between p-3 border border-gray-200 rounded bg-gray-50 cursor-pointer">
            <div>
              <p className="font-semibold text-gray-900">Enable GST Calculation &amp; Tax Invoices</p>
              <p className="text-[11px] text-gray-500">Show CGST/SGST (Uttar Pradesh) or IGST (Inter-state) at checkout and on PDF invoices.</p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(invSettings.gst_enabled)}
              onChange={(e) => setInvField('gst_enabled', e.target.checked)}
              className="w-4 h-4"
            />
          </label>

          {gstWarningMissing && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                GST is enabled, but <strong>Legal Business Name</strong> or <strong>GSTIN</strong> is blank. Invoices will display &ldquo;GSTIN: Not Configured&rdquo; until you enter your registered details.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-600 mb-1">Registered Legal Business Name</label>
              <input
                value={invSettings.legal_name || ''}
                onChange={(e) => setInvField('legal_name', e.target.value)}
                placeholder="Enter registered legal name (optional)"
                className="w-full border border-gray-300 rounded px-2.5 py-1.5"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">GSTIN (15-character GST Number)</label>
              <input
                value={invSettings.gstin || ''}
                onChange={(e) => setInvField('gstin', e.target.value.toUpperCase())}
                placeholder="Leave blank if unregistered"
                maxLength={15}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Seller Origin State</label>
              <select
                value={invSettings.seller_state || 'Uttar Pradesh'}
                onChange={(e) => setInvField('seller_state', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white"
              >
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Default GST Rate (%)</label>
              <div className="flex gap-2">
                <select
                  value={[0, 5, 12, 18, 28].includes(Number(invSettings.default_gst_rate)) ? String(invSettings.default_gst_rate) : 'custom'}
                  onChange={(e) => {
                    if (e.target.value !== 'custom') setInvField('default_gst_rate', Number(e.target.value));
                  }}
                  className="border border-gray-300 rounded px-2 py-1.5 bg-white"
                >
                  <option value="0">0%</option>
                  <option value="5">5% (Apparel ≤ ₹1000)</option>
                  <option value="12">12% (Apparel &gt; ₹1000)</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                  <option value="custom">Custom</option>
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={invSettings.default_gst_rate ?? 0}
                  onChange={(e) => setInvField('default_gst_rate', Number(e.target.value))}
                  className="w-20 border border-gray-300 rounded px-2 py-1.5 tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Tax Calculation Mode</label>
              <select
                value={invSettings.tax_calculation_mode || 'inclusive'}
                onChange={(e) => setInvField('tax_calculation_mode', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white"
              >
                <option value="inclusive">Tax Inclusive (Product prices include GST)</option>
                <option value="exclusive">Tax Exclusive (Add GST on top at checkout)</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-600 mb-1">Return / Exchange Window (Days)</label>
              <input
                type="number"
                min={1}
                value={invSettings.return_window_days || 7}
                onChange={(e) => setInvField('return_window_days', Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-2.5 py-1.5 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-600 mb-1">Invoice Footer Note</label>
            <input
              value={invSettings.footer_note || ''}
              onChange={(e) => setInvField('footer_note', e.target.value)}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5"
            />
          </div>

          <button
            type="button"
            onClick={() => saveSetting('invoice_settings', invSettings, 'GST & Invoice settings')}
            className="px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer"
          >
            Save GST &amp; Invoice Settings
          </button>
        </div>
      </div>

      {/* Homepage Sections */}
      <div className="border border-gray-200 bg-white rounded-md p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Homepage Sections (Content, Order &amp; Visibility)</h2>
        <div className="space-y-3">
          {cms.sections.map((sec: any, idx: number) => (
            <div key={sec.id} className="border border-gray-200 rounded p-3 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-center">
              <div className="md:col-span-3">
                <p className="font-mono text-[10px] text-gray-400">{sec.section_key}</p>
                <input
                  value={sec.title}
                  onChange={(e) => {
                    const next = [...cms.sections];
                    next[idx].title = e.target.value;
                    setCms({ ...cms, sections: next });
                  }}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 font-medium"
                />
              </div>
              <div className="md:col-span-4">
                <input
                  value={sec.subtitle || ''}
                  onChange={(e) => {
                    const next = [...cms.sections];
                    next[idx].subtitle = e.target.value;
                    setCms({ ...cms, sections: next });
                  }}
                  placeholder="Subtitle"
                  className="w-full border border-gray-300 rounded px-2 py-1.5"
                />
              </div>
              <div className="md:col-span-2">
                <input
                  type="number"
                  value={sec.sort_order}
                  onChange={(e) => {
                    const next = [...cms.sections];
                    next[idx].sort_order = Number(e.target.value);
                    setCms({ ...cms, sections: next });
                  }}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 tabular-nums"
                />
              </div>
              <label className="md:col-span-1 flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(sec.is_visible)}
                  onChange={(e) => {
                    const next = [...cms.sections];
                    next[idx].is_visible = e.target.checked ? 1 : 0;
                    setCms({ ...cms, sections: next });
                  }}
                />
                <span>Show</span>
              </label>
              <div className="md:col-span-2 text-right">
                <button type="button" onClick={() => saveSection(sec)} className="px-3 py-1.5 bg-gray-900 text-white rounded cursor-pointer">
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Legacy aliases so no route breaks
export const AdminTaxonomy = AdminCategoriesPage;
export const AdminCms = AdminSettingsPage;

export function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  useEffect(() => {
    apiFetch<{ customers: any[] }>('/api/admin/customers').then((r) => setCustomers(r.customers)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Registered Customers</h1>
      <div className="border border-gray-200 bg-white rounded-md overflow-x-auto">
        <table className="w-full text-xs text-left tabular-nums">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <th className="p-3">Customer</th>
              <th className="p-3">Mobile</th>
              <th className="p-3">Email</th>
              <th className="p-3">Orders</th>
              <th className="p-3 text-right">Total Spent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">No registered customer accounts yet.</td></tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id}>
                  <td className="p-3 font-medium text-gray-900">{c.full_name}</td>
                  <td className="p-3 text-gray-700">{c.phone}</td>
                  <td className="p-3 text-gray-500">{c.email || '—'}</td>
                  <td className="p-3 text-gray-700">{c.order_count}</td>
                  <td className="p-3 text-right font-semibold text-gray-900">{formatINR(c.total_spent)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminTeam() {
  const { user, notify } = useStore();
  const [staff, setStaff] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [newStaff, setNewStaff] = useState({ full_name: '', email: '', phone: '', password: '', role: 'manager' });

  const isOwner = user?.roles.includes('owner');

  const load = () => {
    if (isOwner) {
      apiFetch<{ staff: any[]; permissions: any[] }>('/api/admin/staff').then((r) => {
        setStaff(r.staff);
        setPermissions(r.permissions);
      });
    }
    apiFetch<{ logs: any[] }>('/api/admin/activity-logs').then((r) => setLogs(r.logs));
  };

  useEffect(load, [isOwner]);

  const addStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/staff', { method: 'POST', body: JSON.stringify(newStaff) });
      setNewStaff({ full_name: '', email: '', phone: '', password: '', role: 'manager' });
      notify('Staff account provisioned');
      load();
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const togglePerm = async (role: string, permission_key: string, allowed: boolean) => {
    await apiFetch('/api/admin/permissions', {
      method: 'PUT',
      body: JSON.stringify({ role, permission_key, allowed }),
    });
    notify('Permission updated');
    load();
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Multi-Admin Staff, Permissions &amp; Audit Logs</h1>

      {isOwner && (
        <>
          <div className="border border-gray-200 bg-white rounded-md p-5 space-y-4 text-xs">
            <h2 className="text-sm font-semibold text-gray-900">Provision Staff Administrator (Owner Only)</h2>
            <form onSubmit={addStaff} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <input required placeholder="Full Name" value={newStaff.full_name} onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2" />
              <input required type="email" placeholder="Staff Email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2" />
              <input required placeholder="Mobile" value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2" />
              <input required minLength={6} type="password" placeholder="Initial Password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} className="border border-gray-300 rounded px-2.5 py-2" />
              <div className="flex gap-2">
                <select value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} className="flex-1 border border-gray-300 rounded px-2 py-2">
                  <option value="manager">Manager</option>
                  <option value="order_staff">Order Staff</option>
                  <option value="content_staff">Content Staff</option>
                </select>
                <button type="submit" className="px-3 bg-gray-900 text-white rounded font-medium cursor-pointer">Add</button>
              </div>
            </form>

            <div className="divide-y divide-gray-100">
              {staff.map((s) => (
                <div key={s.id} className="py-2.5 flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <span className="font-semibold text-gray-900">{s.full_name}</span>
                    <span className="text-gray-500 ml-2">{s.email} · {s.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="uppercase font-mono text-[11px]">{s.role}</span>
                    {s.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/staff/${s.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ is_active: !s.is_active }),
                          });
                          load();
                        }}
                        className="underline text-gray-600 cursor-pointer"
                      >
                        {s.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-gray-200 bg-white rounded-md p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-gray-900">Role Permission Matrix</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['manager', 'order_staff', 'content_staff'].map((r) => (
                <div key={r} className="border border-gray-200 rounded p-3 space-y-2">
                  <p className="font-semibold uppercase tracking-wider text-gray-900">{r.replace('_', ' ')}</p>
                  {permissions.filter((p) => p.role === r).map((p) => (
                    <label key={p.id} className="flex items-center justify-between cursor-pointer">
                      <span className="text-gray-600">{p.permission_key}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(p.allowed)}
                        onChange={(e) => togglePerm(r, p.permission_key, e.target.checked)}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="border border-gray-200 bg-white rounded-md p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Administrative Activity Audit Log</h2>
        <div className="divide-y divide-gray-100 text-xs max-h-96 overflow-y-auto tabular-nums">
          {logs.map((l) => (
            <div key={l.id} className="py-2 flex justify-between gap-4">
              <div>
                <span className="font-semibold text-gray-900">{l.admin_name}</span> — <span className="font-mono">{l.action}</span> ({l.entity_type})
              </div>
              <span className="text-gray-500 shrink-0">{new Date(l.created_at).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
