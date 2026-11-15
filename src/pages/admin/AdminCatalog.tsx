import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  EyeOff,
  ImagePlus,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { apiFetch, DEPARTMENT_LABELS, formatINR, getAuthToken } from '../../lib/api';

async function downloadProductCsv() {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch('/api/admin/products/export/csv', { credentials: 'include', headers });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'arora-garments-catalog.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function generateAutoSlug(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `product-${Date.now().toString().slice(-6)}`
  );
}

function makeVariantSku(prefix: string, size: string, color: string, index: number) {
  const cleanPrefix = (prefix || 'AG').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase() || 'AG';
  const cleanSize = (size || 'STD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5) || 'STD';
  const cleanColor = (color || 'CLR').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'CLR';
  return `${cleanPrefix}-${cleanSize}-${cleanColor}-${index + 1}`;
}

export function AdminProducts() {
  const { notify } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<any | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'drafts'>(
    searchParams.get('filter') === 'drafts' ? 'drafts' : 'all'
  );
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Product modal UX states
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualImageUrl, setManualImageUrl] = useState('');

  const load = async () => {
    const [pRes, cRes, sRes] = await Promise.all([
      apiFetch<{ products: any[] }>('/api/admin/products'),
      apiFetch<{ categories: any[] }>('/api/admin/categories'),
      apiFetch('/api/admin/storage'),
    ]);
    setProducts(pRes.products);
    setCategories(cRes.categories);
    setStorageInfo(sRes);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const changeFilterTab = (tab: 'all' | 'published' | 'drafts') => {
    setStatusFilter(tab);
    if (tab === 'drafts') {
      setSearchParams({ filter: 'drafts' });
    } else {
      setSearchParams({});
    }
  };

  const draftCount = products.filter((p) => !p.is_archived && (!p.is_published || p.review_status === 'draft_needs_review')).length;
  const publishedCount = products.filter((p) => !p.is_archived && p.is_published).length;

  const filteredProducts = products.filter((p) => {
    if (deptFilter !== 'all' && p.department !== deptFilter) return false;
    if (statusFilter === 'published') return Boolean(p.is_published) && !p.is_archived;
    if (statusFilter === 'drafts') return !p.is_archived && (!p.is_published || p.review_status === 'draft_needs_review');
    return true;
  });

  const togglePublishStatus = async (p: any, nextPublished: boolean) => {
    try {
      await apiFetch(`/api/admin/products/${p.id}/publish`, {
        method: 'PATCH',
        body: JSON.stringify({ is_published: nextPublished }),
      });
      notify(nextPublished ? `"${p.title}" published live` : `"${p.title}" moved to drafts`);
      load();
    } catch (err: any) {
      notify(err.message || 'Status update failed', 'error');
    }
  };

  const resetModalHelpers = () => {
    setUploadProgress(null);
    setUploadError(null);
    setFormError(null);
    setDragOver(false);
    setShowAdvanced(false);
    setShowUrlInput(false);
    setManualImageUrl('');
  };

  const openNew = () => {
    resetModalHelpers();
    const autoPrefix = `AG-${Date.now().toString().slice(-4)}`;
    setEditing({
      id: null,
      title: '',
      slug: '',
      sku_prefix: autoPrefix,
      description: '',
      fabric_care: '',
      department: 'mens-wear',
      category_id: '',
      subcategory_id: '',
      regular_price: 1499,
      discounted_price: '',
      gst_rate: '',
      product_type: 'Apparel',
      tagsText: '',
      is_featured: false,
      is_best_seller: false,
      is_new_arrival: true,
      is_trending: false,
      is_published: true,
      images: [],
      variants: [
        {
          sku: `${autoPrefix}-M-BLK-1`,
          size: 'M',
          color: 'Black',
          color_hex: '#111827',
          quantity_available: 10,
          low_stock_threshold: 5,
        },
      ],
    });
  };

  const openEdit = (p: any) => {
    resetModalHelpers();
    setEditing({
      ...p,
      discounted_price: p.discounted_price ?? '',
      gst_rate: p.gst_rate ?? '',
      tagsText: (p.tags || []).join(', '),
      is_featured: Boolean(p.is_featured),
      is_best_seller: Boolean(p.is_best_seller),
      is_new_arrival: Boolean(p.is_new_arrival),
      is_trending: Boolean(p.is_trending),
      is_published: Boolean(p.is_published),
      images: (p.images || []).map((img: any, idx: number) => ({
        ...img,
        is_primary: idx === 0 || Boolean(img.is_primary),
      })),
      variants:
        p.variants && p.variants.length > 0
          ? p.variants.map((v: any) => ({ ...v }))
          : [
              {
                sku: `${p.sku_prefix || 'AG'}-M-BLK-1`,
                size: 'M',
                color: 'Black',
                color_hex: '#111827',
                quantity_available: 10,
                low_stock_threshold: 5,
              },
            ],
    });
  };

  const uploadSingleFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('bucket', 'products');
    const res = await apiFetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: fd });
    return res.url;
  };

  const handleMultiFileUpload = async (files: FileList | File[] | null) => {
    if (!files || !editing) return;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(f.name));
    if (list.length === 0) {
      setUploadError('Please choose image files (JPG, PNG, WEBP, GIF, or AVIF).');
      return;
    }

    setUploadError(null);
    setUploadProgress({ done: 0, total: list.length });
    const uploaded: Array<{ image_url: string; alt_text: string; is_primary: boolean }> = [];
    const failures: string[] = [];

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const url = await uploadSingleFile(file);
        uploaded.push({
          image_url: url,
          alt_text: editing.title || file.name.replace(/\.[^.]+$/, ''),
          is_primary: false,
        });
      } catch (err: any) {
        failures.push(`${file.name}: ${err.message || 'Upload failed'}`);
      } finally {
        setUploadProgress({ done: i + 1, total: list.length });
      }
    }

    if (uploaded.length > 0) {
      setEditing((prev: any) => {
        if (!prev) return prev;
        const merged = [...prev.images, ...uploaded].map((img: any, idx: number) => ({
          ...img,
          is_primary: idx === 0,
        }));
        return { ...prev, images: merged };
      });
      notify(`Uploaded ${uploaded.length} photo${uploaded.length > 1 ? 's' : ''}`);
    }

    if (failures.length > 0) {
      setUploadError(failures.join(' · '));
    }

    setTimeout(() => setUploadProgress(null), 600);
  };

  const handleReplaceImage = async (idx: number, file: File | undefined) => {
    if (!file || !editing) return;
    setUploadError(null);
    setUploadProgress({ done: 0, total: 1 });
    try {
      const url = await uploadSingleFile(file);
      setEditing((prev: any) => {
        if (!prev) return prev;
        const next = [...prev.images];
        next[idx] = { ...next[idx], image_url: url };
        return { ...prev, images: next };
      });
      notify('Photo replaced');
    } catch (err: any) {
      setUploadError(err.message || 'Could not replace photo');
    } finally {
      setUploadProgress(null);
    }
  };

  const setMainImage = (idx: number) => {
    if (!editing || idx === 0) return;
    const next = [...editing.images];
    const [picked] = next.splice(idx, 1);
    const reordered = [picked, ...next].map((img: any, i: number) => ({ ...img, is_primary: i === 0 }));
    setEditing({ ...editing, images: reordered });
  };

  const moveImage = (idx: number, direction: -1 | 1) => {
    if (!editing) return;
    const target = idx + direction;
    if (target < 0 || target >= editing.images.length) return;
    const next = [...editing.images];
    [next[idx], next[target]] = [next[target], next[idx]];
    const normalized = next.map((img: any, i: number) => ({ ...img, is_primary: i === 0 }));
    setEditing({ ...editing, images: normalized });
  };

  const removeImage = (idx: number) => {
    if (!editing) return;
    const remaining = editing.images
      .filter((_: any, i: number) => i !== idx)
      .map((img: any, i: number) => ({ ...img, is_primary: i === 0 }));
    setEditing({ ...editing, images: remaining });
  };

  const addPresetSizes = (sizes: string[]) => {
    if (!editing) return;
    const existingKeys = new Set(editing.variants.map((v: any) => `${v.size.toLowerCase()}__${v.color.toLowerCase()}`));
    const defaultColor = editing.variants[0]?.color || 'Black';
    const defaultHex = editing.variants[0]?.color_hex || '#111827';
    const prefix = editing.sku_prefix || 'AG';
    const additions = sizes
      .filter((s) => !existingKeys.has(`${s.toLowerCase()}__${defaultColor.toLowerCase()}`))
      .map((size, i) => ({
        sku: makeVariantSku(prefix, size, defaultColor, editing.variants.length + i),
        size,
        color: defaultColor,
        color_hex: defaultHex,
        quantity_available: 10,
        low_stock_threshold: 5,
      }));
    if (additions.length === 0) {
      notify(`Sizes ${sizes.join(', ')} already exist for ${defaultColor}`);
      return;
    }
    setEditing({ ...editing, variants: [...editing.variants, ...additions] });
  };

  const submitProduct = async (publishNow: boolean) => {
    if (!editing) return;
    setFormError(null);

    if (!editing.title?.trim()) {
      setFormError('Please enter a Product Name.');
      return;
    }
    if (!editing.description?.trim()) {
      setFormError('Please enter a short Product Description for customers.');
      return;
    }
    const regularPrice = Number(editing.regular_price);
    if (!Number.isFinite(regularPrice) || regularPrice <= 0) {
      setFormError('Regular Price (MRP) must be greater than ₹0.');
      return;
    }
    const discountedPrice =
      editing.discounted_price !== '' && editing.discounted_price !== null && editing.discounted_price !== undefined
        ? Number(editing.discounted_price)
        : null;
    if (discountedPrice !== null && (Number.isNaN(discountedPrice) || discountedPrice < 0 || discountedPrice > regularPrice)) {
      setFormError('Discounted Price must be ₹0 or higher and cannot exceed Regular Price.');
      return;
    }
    if (!editing.variants || editing.variants.length === 0) {
      setFormError('Please keep at least one Size / Colour variant.');
      return;
    }
    for (const v of editing.variants) {
      if (!v.size?.trim() || !v.color?.trim()) {
        setFormError('Every size & colour variant must have a Size and a Colour.');
        return;
      }
    }

    const validImages = (editing.images || [])
      .filter((img: any) => Boolean(img.image_url?.trim()))
      .map((img: any, idx: number) => ({
        image_url: img.image_url.trim(),
        alt_text: img.alt_text?.trim() || editing.title.trim(),
        is_primary: idx === 0,
      }));

    if (publishNow && validImages.length === 0) {
      setFormError('Please upload at least 1 product photo before publishing live (or choose Save as Draft).');
      return;
    }

    const deptParent = categories.find((c) => !c.parent_id && c.department === editing.department);
    const autoPrefix = editing.sku_prefix?.trim() || `AG-${Date.now().toString().slice(-5)}`;
    const autoSlug = editing.slug?.trim() || generateAutoSlug(editing.title);

    const payload = {
      title: editing.title.trim(),
      slug: autoSlug,
      sku_prefix: autoPrefix,
      description: editing.description.trim(),
      fabric_care: editing.fabric_care?.trim() || undefined,
      department: editing.department,
      category_id: editing.category_id || deptParent?.id || null,
      subcategory_id: editing.subcategory_id || null,
      regular_price: regularPrice,
      discounted_price: discountedPrice,
      gst_rate:
        editing.gst_rate !== '' && editing.gst_rate !== null && editing.gst_rate !== undefined
          ? Number(editing.gst_rate)
          : null,
      product_type: editing.product_type?.trim() || 'Apparel',
      tags: (editing.tagsText || '')
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean),
      is_featured: Boolean(editing.is_featured),
      is_best_seller: Boolean(editing.is_best_seller),
      is_new_arrival: Boolean(editing.is_new_arrival),
      is_trending: Boolean(editing.is_trending),
      is_published: publishNow,
      review_status: publishNow ? 'approved' : 'draft_needs_review',
      images: validImages,
      variants: editing.variants.map((v: any, idx: number) => ({
        id: v.id,
        sku: v.sku?.trim() || makeVariantSku(autoPrefix, v.size, v.color, idx),
        size: v.size.trim(),
        color: v.color.trim(),
        color_hex: v.color_hex || '#111827',
        quantity_available: Math.max(0, Number(v.quantity_available) || 0),
        low_stock_threshold: Math.max(0, Number(v.low_stock_threshold ?? 5)),
      })),
    };

    setSaving(true);
    try {
      if (editing.id) {
        await apiFetch(`/api/admin/products/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        notify(publishNow ? `"${payload.title}" saved & published live` : `"${payload.title}" saved as draft`);
      } else {
        await apiFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
        notify(publishNow ? `"${payload.title}" published to storefront` : `"${payload.title}" saved as draft`);
      }
      setEditing(null);
      load();
    } catch (err: any) {
      setFormError(err.message || 'Could not save product. Please check your entries.');
      notify(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const runBulk = async (action: string) => {
    if (selectedIds.size === 0) return;
    await apiFetch('/api/admin/products/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids: Array.from(selectedIds), action }),
    });
    setSelectedIds(new Set());
    notify(`Bulk ${action} completed`);
    load();
  };

  const duplicateProduct = async (id: string) => {
    await apiFetch(`/api/admin/products/${id}/duplicate`, { method: 'POST' });
    notify('Product duplicated (unpublished draft)');
    load();
  };

  const regularNum = editing ? Number(editing.regular_price) || 0 : 0;
  const saleNum =
    editing && editing.discounted_price !== '' && editing.discounted_price !== null
      ? Number(editing.discounted_price)
      : null;
  const discountPct =
    saleNum !== null && regularNum > 0 && saleNum < regularNum
      ? Math.round(((regularNum - saleNum) / regularNum) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Products &amp; Easy Catalogue Upload</h1>
          {storageInfo && (
            <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
              {products.length} total items ({publishedCount} live · {draftCount} drafts) · {storageInfo.uploaded_files} uploaded photos ({storageInfo.total_mb} MB)
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button type="button" onClick={downloadProductCsv} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white rounded font-medium cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button type="button" onClick={() => setCsvImportOpen((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white rounded font-medium cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer hover:bg-gray-800">
            <Plus className="w-3.5 h-3.5" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Department Select */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-md p-3 text-xs">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => changeFilterTab('all')}
            className={`px-3 py-1.5 rounded font-medium cursor-pointer ${statusFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            All ({products.length})
          </button>
          <button
            type="button"
            onClick={() => changeFilterTab('published')}
            className={`px-3 py-1.5 rounded font-medium cursor-pointer ${statusFilter === 'published' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Published Live ({publishedCount})
          </button>
          <button
            type="button"
            onClick={() => changeFilterTab('drafts')}
            className={`px-3 py-1.5 rounded font-medium cursor-pointer ${statusFilter === 'drafts' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}
          >
            Drafts ({draftCount})
          </button>
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="border border-gray-300 rounded px-2.5 py-1.5 bg-white">
          <option value="all">All Departments</option>
          <option value="mens-wear">Men&apos;s Wear</option>
          <option value="womens-wear">Women&apos;s Wear</option>
          <option value="kids-wear">Kids Wear</option>
          <option value="footwear">Footwear</option>
        </select>
      </div>

      {csvImportOpen && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await apiFetch<{ imported: number }>('/api/admin/products/import/csv', {
              method: 'POST',
              body: JSON.stringify({ csv: csvText }),
            });
            notify(`Imported ${res.imported} product(s)`);
            setCsvImportOpen(false);
            setCsvText('');
            load();
          }}
          className="border border-gray-200 bg-white rounded-md p-4 space-y-3 text-xs"
        >
          <p className="font-semibold">Paste CSV (Header: title,slug,sku_prefix,department,regular_price,discounted_price)</p>
          <textarea rows={4} value={csvText} onChange={(e) => setCsvText(e.target.value)} className="w-full border border-gray-300 rounded p-2 font-mono" />
          <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer">Run Import</button>
        </form>
      )}

      {selectedIds.size > 0 && (
        <div className="border border-gray-900 bg-white rounded-md px-4 py-2.5 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold">{selectedIds.size} selected</span>
          <button type="button" onClick={() => runBulk('publish')} className="underline text-emerald-700 font-medium cursor-pointer">Publish Selected</button>
          <button type="button" onClick={() => runBulk('unpublish')} className="underline cursor-pointer">Move to Draft</button>
          <button type="button" onClick={() => runBulk('archive')} className="underline cursor-pointer">Archive</button>
          <button type="button" onClick={() => runBulk('delete')} className="underline text-rose-700 cursor-pointer">Delete</button>
        </div>
      )}

      <div className="border border-gray-200 bg-white rounded-md overflow-x-auto">
        <table className="w-full text-xs text-left tabular-nums">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <th className="p-3 w-8">
                <input
                  type="checkbox"
                  checked={filteredProducts.length > 0 && selectedIds.size === filteredProducts.length}
                  onChange={(e) => setSelectedIds(e.target.checked ? new Set(filteredProducts.map((p) => p.id)) : new Set())}
                />
              </th>
              <th className="p-3">Product</th>
              <th className="p-3">Department</th>
              <th className="p-3">Price</th>
              <th className="p-3">Variants / Stock</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map((p) => {
              const totalStock = (p.variants || []).reduce((s: number, v: any) => s + (v.quantity_available || 0), 0);
              const needsReview = !p.is_published || p.review_status === 'draft_needs_review';
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        e.target.checked ? next.add(p.id) : next.delete(p.id);
                        setSelectedIds(next);
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {p.images?.[0]?.image_url ? (
                        <img src={p.images[0].image_url} alt={p.title} className="w-10 h-12 object-cover border border-gray-200 rounded-sm" />
                      ) : (
                        <div className="w-10 h-12 bg-gray-100 border border-gray-200 rounded-sm flex items-center justify-center text-[10px] text-gray-400">
                          No img
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">{p.title}</p>
                        <p className="font-mono text-gray-500 text-[11px]">{p.sku_prefix}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-gray-700">{DEPARTMENT_LABELS[p.department] || p.department}</td>
                  <td className="p-3">
                    <span className="font-semibold text-gray-900">{formatINR(p.discounted_price ?? p.regular_price)}</span>
                    {p.discounted_price && <span className="ml-1.5 line-through text-gray-400">{formatINR(p.regular_price)}</span>}
                    {p.gst_rate !== null && p.gst_rate !== undefined && (
                      <p className="text-[10px] text-gray-500">GST {p.gst_rate}%</p>
                    )}
                  </td>
                  <td className="p-3 text-gray-700">{p.variants?.length || 0} variants · {totalStock} units</td>
                  <td className="p-3">
                    {p.is_archived ? (
                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[11px]">Archived</span>
                    ) : needsReview ? (
                      <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[11px] font-medium">
                        Draft
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[11px] font-medium">
                        Published Live
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    {!p.is_archived && (
                      needsReview ? (
                        <button
                          type="button"
                          onClick={() => togglePublishStatus(p, true)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-700 text-white rounded text-[11px] font-medium cursor-pointer hover:bg-emerald-800"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Publish</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => togglePublishStatus(p, false)}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 text-gray-700 rounded text-[11px] cursor-pointer hover:bg-gray-100"
                          title="Move to Draft"
                        >
                          <EyeOff className="w-3 h-3" />
                          <span>Unpublish</span>
                        </button>
                      )
                    )}
                    <button type="button" onClick={() => openEdit(p)} className="underline font-medium text-gray-900 cursor-pointer">Edit</button>
                    <button type="button" onClick={() => duplicateProduct(p.id)} className="underline text-gray-500 cursor-pointer" title="Duplicate">
                      <Copy className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Simplified Product Upload & Editor Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-lg max-w-4xl w-full max-h-[94vh] flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {editing.id ? 'Edit Product Details & Photos' : 'Add a New Product'}
                </h2>
                <p className="text-xs text-gray-500">
                  Upload photos from phone or computer, set price &amp; sizes, then save as draft or publish live.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-6 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* STEP 1: Product Photos (Drag & Drop + Mobile Gallery/Camera Picker) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">1. Product Photos</h3>
                    <p className="text-[11px] text-gray-500">Select multiple photos at once. The first photo becomes the main display image.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput((v) => !v)}
                    className="text-[11px] underline text-gray-600 cursor-pointer"
                  >
                    {showUrlInput ? 'Hide URL input' : 'Or add photo by web link'}
                  </button>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleMultiFileUpload(e.dataTransfer.files);
                  }}
                  className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors ${
                    dragOver ? 'border-gray-900 bg-gray-100' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <ImagePlus className="w-8 h-8 mx-auto text-gray-500 mb-2" />
                  <p className="font-medium text-gray-900 text-sm">
                    Drag &amp; drop product photos here
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
                    Supports JPG, PNG, WEBP up to 5 MB per photo · Multi-select supported
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-md font-medium cursor-pointer hover:bg-gray-800 text-xs">
                    <Upload className="w-4 h-4" />
                    <span>Choose Photos from Phone or Computer</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        handleMultiFileUpload(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {uploadProgress && (
                    <div className="mt-3 max-w-xs mx-auto space-y-1">
                      <p className="text-[11px] font-medium text-gray-800">
                        Uploading photo {uploadProgress.done} of {uploadProgress.total}...
                      </p>
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-900 transition-all"
                          style={{ width: `${Math.round((uploadProgress.done / Math.max(uploadProgress.total, 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {uploadError && (
                    <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-[11px] text-left">
                      {uploadError}
                    </div>
                  )}
                </div>

                {showUrlInput && (
                  <div className="flex gap-2">
                    <input
                      value={manualImageUrl}
                      onChange={(e) => setManualImageUrl(e.target.value)}
                      placeholder="Paste image path or URL (/assets/... or https://...)"
                      className="flex-1 border border-gray-300 rounded px-3 py-2 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!manualImageUrl.trim()) return;
                        const next = [
                          ...editing.images,
                          {
                            image_url: manualImageUrl.trim(),
                            alt_text: editing.title || 'Product photo',
                            is_primary: editing.images.length === 0,
                          },
                        ];
                        setEditing({ ...editing, images: next });
                        setManualImageUrl('');
                      }}
                      className="px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer"
                    >
                      Add Photo
                    </button>
                  </div>
                )}

                {editing.images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
                    {editing.images.map((img: any, idx: number) => (
                      <div key={`${img.image_url}-${idx}`} className="border border-gray-200 rounded-md overflow-hidden bg-white flex flex-col">
                        <div className="relative aspect-[3/4] bg-gray-100">
                          <img src={img.image_url} alt={img.alt_text || `Photo ${idx + 1}`} className="w-full h-full object-cover" />
                          {idx === 0 && (
                            <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-gray-900 text-white text-[10px] font-medium rounded">
                              Main Photo
                            </span>
                          )}
                        </div>
                        <div className="p-2 space-y-1.5 bg-white">
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveImage(idx, -1)}
                              className="p-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-35 cursor-pointer"
                              title="Move Left"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === editing.images.length - 1}
                              onClick={() => moveImage(idx, 1)}
                              className="p-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-35 cursor-pointer"
                              title="Move Right"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <label
                              className="p-1 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                              title="Replace this photo"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  handleReplaceImage(idx, e.target.files?.[0]);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="p-1 border border-rose-200 text-rose-700 rounded hover:bg-rose-50 cursor-pointer"
                              title="Delete photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {idx !== 0 && (
                            <button
                              type="button"
                              onClick={() => setMainImage(idx)}
                              className="w-full py-1 border border-gray-300 rounded text-[11px] font-medium text-gray-800 hover:bg-gray-50 inline-flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Star className="w-3 h-3" />
                              <span>Set as Main</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* STEP 2: Basic Details & Pricing */}
              <div className="space-y-4 border-t border-gray-200 pt-5">
                <h3 className="text-sm font-semibold text-gray-900">2. Product Information &amp; Pricing</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-gray-700 mb-1">Product Name *</label>
                    <input
                      required
                      placeholder="e.g. Tailored Oxford Cotton Formal Shirt"
                      value={editing.title}
                      onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Department *</label>
                    <select
                      value={editing.department}
                      onChange={(e) => setEditing({ ...editing, department: e.target.value, subcategory_id: '' })}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                    >
                      <option value="mens-wear">Men&apos;s Wear</option>
                      <option value="womens-wear">Women&apos;s Wear</option>
                      <option value="kids-wear">Kids Wear</option>
                      <option value="footwear">Footwear</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Subcategory</label>
                    <select
                      value={editing.subcategory_id || ''}
                      onChange={(e) => setEditing({ ...editing, subcategory_id: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
                    >
                      <option value="">General / All in Department</option>
                      {categories
                        .filter((c) => c.parent_id && c.department === editing.department)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Regular Price / MRP (₹) *</label>
                    <input
                      required
                      type="number"
                      min={1}
                      value={editing.regular_price}
                      onChange={(e) => setEditing({ ...editing, regular_price: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 tabular-nums"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-medium text-gray-700">Offer / Discounted Price (₹)</label>
                      {discountPct > 0 && <span className="text-emerald-700 font-semibold">{discountPct}% OFF</span>}
                    </div>
                    <input
                      type="number"
                      min={0}
                      placeholder="Optional sale price"
                      value={editing.discounted_price}
                      onChange={(e) => setEditing({ ...editing, discounted_price: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 tabular-nums"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-gray-700 mb-1">Description *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe fit, fabric feel, occasion, and styling highlights..."
                      value={editing.description}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      className="w-full border border-gray-300 rounded p-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Fabric &amp; Care (Optional)</label>
                    <input
                      placeholder="e.g. 100% Pure Cotton · Machine wash cold"
                      value={editing.fabric_care || ''}
                      onChange={(e) => setEditing({ ...editing, fabric_care: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-1">Product GST Rate % (Optional Override)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      placeholder="Leave blank to use Store Default GST"
                      value={editing.gst_rate}
                      onChange={(e) => setEditing({ ...editing, gst_rate: e.target.value })}
                      className="w-full border border-gray-300 rounded px-3 py-2 tabular-nums"
                    />
                  </div>
                </div>

                {/* Homepage Showcase Flags */}
                <div className="flex flex-wrap gap-5 pt-1">
                  {[
                    ['is_new_arrival', 'New Arrival'],
                    ['is_trending', 'Trending'],
                    ['is_best_seller', 'Best Seller'],
                    ['is_featured', 'Featured on Homepage'],
                  ].map(([k, lbl]) => (
                    <label key={k} className="flex items-center gap-1.5 cursor-pointer text-gray-800">
                      <input type="checkbox" checked={Boolean(editing[k])} onChange={(e) => setEditing({ ...editing, [k]: e.target.checked })} />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* STEP 3: Sizes, Colours & Stock */}
              <div className="space-y-3 border-t border-gray-200 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">3. Sizes, Colours &amp; Stock Quantity</h3>
                    <p className="text-[11px] text-gray-500">Add each size or colour available in your showroom and set how many pieces are in stock.</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => addPresetSizes(['S', 'M', 'L', 'XL'])}
                      className="px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer text-[11px]"
                    >
                      + S, M, L, XL
                    </button>
                    <button
                      type="button"
                      onClick={() => addPresetSizes(['UK 7', 'UK 8', 'UK 9', 'UK 10'])}
                      className="px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50 cursor-pointer text-[11px]"
                    >
                      + UK 7–10
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          variants: [
                            ...editing.variants,
                            {
                              sku: makeVariantSku(editing.sku_prefix, 'L', 'Black', editing.variants.length),
                              size: 'L',
                              color: editing.variants[0]?.color || 'Black',
                              color_hex: editing.variants[0]?.color_hex || '#111827',
                              quantity_available: 5,
                              low_stock_threshold: 5,
                            },
                          ],
                        })
                      }
                      className="px-3 py-1.5 border border-gray-900 rounded font-medium cursor-pointer hover:bg-gray-50"
                    >
                      + Add Size / Colour
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {editing.variants.map((v: any, idx: number) => (
                    <div key={idx} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center border border-gray-200 rounded-md p-2.5 bg-gray-50/50">
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Size</label>
                        <input
                          required
                          placeholder="M, L, 32, UK 8"
                          value={v.size}
                          onChange={(e) => {
                            const next = [...editing.variants];
                            next[idx].size = e.target.value;
                            setEditing({ ...editing, variants: next });
                          }}
                          className="w-full border border-gray-300 bg-white rounded px-2 py-1.5"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Colour Name</label>
                        <input
                          required
                          placeholder="e.g. Navy Blue"
                          value={v.color}
                          onChange={(e) => {
                            const next = [...editing.variants];
                            next[idx].color = e.target.value;
                            setEditing({ ...editing, variants: next });
                          }}
                          className="w-full border border-gray-300 bg-white rounded px-2 py-1.5"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Swatch</label>
                        <input
                          type="color"
                          value={v.color_hex || '#111827'}
                          onChange={(e) => {
                            const next = [...editing.variants];
                            next[idx].color_hex = e.target.value;
                            setEditing({ ...editing, variants: next });
                          }}
                          className="h-8 w-full border border-gray-300 rounded cursor-pointer"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Stock Qty</label>
                        <input
                          type="number"
                          min={0}
                          value={v.quantity_available}
                          onChange={(e) => {
                            const next = [...editing.variants];
                            next[idx].quantity_available = Number(e.target.value);
                            setEditing({ ...editing, variants: next });
                          }}
                          className="w-full border border-gray-300 bg-white rounded px-2 py-1.5 tabular-nums"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-0.5">Variant SKU (Auto)</label>
                        <input
                          value={v.sku || ''}
                          placeholder="Auto"
                          onChange={(e) => {
                            const next = [...editing.variants];
                            next[idx].sku = e.target.value;
                            setEditing({ ...editing, variants: next });
                          }}
                          className="w-full border border-gray-300 bg-white rounded px-2 py-1.5 font-mono text-[11px]"
                        />
                      </div>
                      <div className="sm:col-span-1 text-right pt-3 sm:pt-4">
                        <button
                          type="button"
                          disabled={editing.variants.length <= 1}
                          onClick={() => setEditing({ ...editing, variants: editing.variants.filter((_: any, i: number) => i !== idx) })}
                          className="text-rose-700 underline cursor-pointer disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Collapsible Advanced SKU & URL Options */}
              <div className="border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span>Advanced SKU, URL Slug &amp; Search Tags (Auto-filled automatically)</span>
                </button>
                {showAdvanced && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-md">
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">URL Slug</label>
                      <input
                        value={editing.slug}
                        onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                        placeholder="Auto-generated from Product Name"
                        className="w-full border border-gray-300 bg-white rounded px-3 py-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">SKU Prefix</label>
                      <input
                        value={editing.sku_prefix}
                        onChange={(e) => setEditing({ ...editing, sku_prefix: e.target.value })}
                        placeholder="Auto-generated"
                        className="w-full border border-gray-300 bg-white rounded px-3 py-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Garment Type</label>
                      <input
                        value={editing.product_type}
                        onChange={(e) => setEditing({ ...editing, product_type: e.target.value })}
                        placeholder="Apparel"
                        className="w-full border border-gray-300 bg-white rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-gray-700 mb-1">Search Tags (comma separated)</label>
                      <input
                        value={editing.tagsText}
                        onChange={(e) => setEditing({ ...editing, tagsText: e.target.value })}
                        placeholder="cotton, formal, festive"
                        className="w-full border border-gray-300 bg-white rounded px-3 py-2"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer: Explicit Save as Draft vs Publish Live */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
                className="px-4 py-2.5 border border-gray-300 bg-white rounded text-xs font-medium cursor-pointer hover:bg-gray-50"
              >
                Cancel
              </button>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitProduct(false)}
                  className="px-4 py-2.5 border border-gray-900 bg-white text-gray-900 rounded text-xs font-medium cursor-pointer hover:bg-gray-100 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save as Draft'}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => submitProduct(true)}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded text-xs font-medium cursor-pointer hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving ? 'Publishing...' : editing.id ? 'Save & Publish Live' : 'Publish Live'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminInventory() {
  const { notify } = useStore();
  const [variants, setVariants] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [adjusting, setAdjusting] = useState<{ variant_id: string; qty: number; note: string; reason: 'manual_adjustment' | 'reconciliation' } | null>(null);

  const load = () => {
    apiFetch<{ variants: any[]; movements: any[] }>('/api/admin/inventory').then((r) => {
      setVariants(r.variants);
      setMovements(r.movements);
    });
  };

  useEffect(load, []);

  const submitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjusting) return;
    await apiFetch('/api/admin/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({
        variant_id: adjusting.variant_id,
        new_quantity: adjusting.qty,
        reason: adjusting.reason,
        note: adjusting.note,
      }),
    });
    notify('Inventory adjusted');
    setAdjusting(null);
    load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Variant Inventory &amp; Stock Ledger</h1>
        <p className="text-xs text-gray-500 mt-0.5">Atomic SKU-level stock tracking, reservations, and reconciliation movements.</p>
      </div>

      {adjusting && (
        <form onSubmit={submitAdjustment} className="border border-gray-900 bg-white rounded-md p-4 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs items-end">
          <div>
            <label className="block font-medium mb-1">New Quantity</label>
            <input type="number" min={0} required value={adjusting.qty} onChange={(e) => setAdjusting({ ...adjusting, qty: Number(e.target.value) })} className="w-full border border-gray-300 rounded px-2.5 py-2 tabular-nums" />
          </div>
          <div>
            <label className="block font-medium mb-1">Reason</label>
            <select value={adjusting.reason} onChange={(e) => setAdjusting({ ...adjusting, reason: e.target.value as any })} className="w-full border border-gray-300 rounded px-2.5 py-2">
              <option value="manual_adjustment">Manual Adjustment</option>
              <option value="reconciliation">Physical Reconciliation</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block font-medium mb-1">Note</label>
            <input value={adjusting.note} onChange={(e) => setAdjusting({ ...adjusting, note: e.target.value })} placeholder="Reason or stockroom reference" className="w-full border border-gray-300 rounded px-2.5 py-2" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer">Save</button>
            <button type="button" onClick={() => setAdjusting(null)} className="px-3 py-2 border border-gray-300 rounded cursor-pointer">Cancel</button>
          </div>
        </form>
      )}

      <div className="border border-gray-200 bg-white rounded-md overflow-x-auto">
        <table className="w-full text-xs text-left tabular-nums">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <th className="p-3">SKU</th>
              <th className="p-3">Product</th>
              <th className="p-3">Size / Colour</th>
              <th className="p-3">Available</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {variants.map((v) => (
              <tr key={v.variant_id}>
                <td className="p-3 font-mono">{v.sku}</td>
                <td className="p-3 font-medium text-gray-900">{v.title}</td>
                <td className="p-3 text-gray-700">{v.size} / {v.color}</td>
                <td className="p-3 font-semibold text-gray-900">{v.quantity_available}</td>
                <td className="p-3">
                  {v.quantity_available === 0 ? (
                    <span className="text-rose-700 font-semibold">Out of Stock</span>
                  ) : v.quantity_available <= v.low_stock_threshold ? (
                    <span className="text-amber-700 font-semibold">Low Stock</span>
                  ) : (
                    <span className="text-emerald-700">In Stock</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => setAdjusting({ variant_id: v.variant_id, qty: v.quantity_available, note: '', reason: 'manual_adjustment' })}
                    className="underline font-medium text-gray-900 cursor-pointer"
                  >
                    Adjust Stock
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-gray-200 bg-white rounded-md p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Recent Stock Movements</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left tabular-nums">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="py-2">Date</th>
                <th className="py-2">SKU</th>
                <th className="py-2">Change</th>
                <th className="py-2">Reason</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 text-gray-500">{new Date(m.created_at).toLocaleString('en-IN')}</td>
                  <td className="py-2 font-mono">{m.sku}</td>
                  <td className={`py-2 font-semibold ${m.change_amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {m.change_amount > 0 ? `+${m.change_amount}` : m.change_amount}
                  </td>
                  <td className="py-2">{m.reason}</td>
                  <td className="py-2 text-gray-500">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
