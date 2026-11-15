import React, { useEffect, useState } from 'react';
import { Check, Image as ImageIcon, MapPin, Palette, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { apiFetch, formatINR } from '../../lib/api';
import { syncBrandingToFirestore, syncThemeToFirestore } from '../../lib/firebase';
import { applyThemeVariables, FONT_OPTIONS_ENGLISH, getThemePreset, THEME_PRESETS } from '../../lib/themes';
import type { AppearanceSettings, BrandingSettings, DeliveryZone } from '../../types';

export function AdminAppearancePage() {
  const { bootstrap, refreshBootstrap, notify } = useStore();
  const [form, setForm] = useState<AppearanceSettings>({
    active_theme_id: 'modern-classic',
    custom_overrides: {
      primary_color: '',
      secondary_color: '',
      background_color: '',
      surface_color: '',
      text_color: '',
      accent_color: '',
      heading_font: '',
      body_font: '',
      button_style: '',
      card_style: '',
      border_radius: '',
      animation_intensity: 'subtle',
    },
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bootstrap?.appearance) {
      setForm({
        active_theme_id: bootstrap.appearance.active_theme_id || 'modern-classic',
        custom_overrides: { ...bootstrap.appearance.custom_overrides },
      });
    }
  }, [bootstrap?.appearance]);

  // Live preview on CSS variables as admin adjusts options
  useEffect(() => {
    applyThemeVariables(form);
  }, [form]);

  const activePreset = getThemePreset(form.active_theme_id);
  const ov = form.custom_overrides || {};

  const updateOverride = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      custom_overrides: { ...(prev.custom_overrides || {}), [key]: value },
    }));
  };

  const selectPreset = (themeId: AppearanceSettings['active_theme_id']) => {
    setForm({
      active_theme_id: themeId,
      custom_overrides: {
        primary_color: '',
        secondary_color: '',
        background_color: '',
        surface_color: '',
        text_color: '',
        accent_color: '',
        heading_font: '',
        body_font: '',
        button_style: '',
        card_style: '',
        border_radius: '',
        animation_intensity: getThemePreset(themeId).animationIntensity,
      },
    });
  };

  const saveAppearance = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings/appearance', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      await syncThemeToFirestore(form as unknown as Record<string, unknown>);
      await refreshBootstrap();
      notify(`Theme "${activePreset.name}" saved and published live`);
    } catch (err: any) {
      notify(err.message || 'Could not save appearance settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const restoreDefault = async () => {
    setSaving(true);
    try {
      const res = await apiFetch<{ appearance: AppearanceSettings }>('/api/admin/appearance/restore-default', {
        method: 'POST',
      });
      setForm(res.appearance);
      await syncThemeToFirestore(res.appearance as unknown as Record<string, unknown>);
      await refreshBootstrap();
      notify('Restored default Modern Classic theme');
    } catch (err: any) {
      notify(err.message || 'Could not restore default theme', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Website Themes &amp; Typography</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Switch between 6 complete fashion retail design systems or customize colours, Indian retail fonts, corners, and card styles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            disabled={saving}
            onClick={restoreDefault}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 bg-white rounded font-medium cursor-pointer hover:bg-gray-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Default Theme</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={saveAppearance}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-gray-900 text-white rounded font-medium cursor-pointer hover:bg-gray-800"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save & Apply Theme'}</span>
          </button>
        </div>
      </div>

      {/* 6 Theme Presets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {THEME_PRESETS.map((preset) => {
          const isSelected = form.active_theme_id === preset.id;
          return (
            <div
              key={preset.id}
              onClick={() => selectPreset(preset.id)}
              className={`cursor-pointer border rounded-md p-4 transition-all bg-white ${
                isSelected ? 'border-gray-900 ring-2 ring-gray-900/15' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{preset.category}</p>
                  <h2 className="text-base font-semibold text-gray-900 mt-0.5">{preset.name}</h2>
                  <p className="text-xs text-gray-500">{preset.tagline}</p>
                </div>
                {isSelected && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-900 text-white text-[10px] font-medium rounded">
                    <Check className="w-3 h-3" /> Active
                  </span>
                )}
              </div>

              {/* Mini Visual Preview Strip */}
              <div
                className="mt-3 p-3 border rounded-sm space-y-2"
                style={{
                  backgroundColor: preset.palette.canvas,
                  borderColor: preset.palette.border,
                  color: preset.palette.ink,
                }}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span style={{ fontFamily: preset.typography.headingFont, fontWeight: preset.typography.headingWeight }}>
                    ARORA GARMENTS
                  </span>
                  <span
                    className="px-2 py-0.5 text-[10px]"
                    style={{
                      backgroundColor: preset.palette.buttonBg,
                      color: preset.palette.buttonText,
                      borderRadius: preset.layout.buttonRadius,
                    }}
                  >
                    Shop
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  {[
                    preset.palette.primary,
                    preset.palette.secondary,
                    preset.palette.accent,
                    preset.palette.surface,
                    preset.palette.canvas,
                  ].map((hex, i) => (
                    <span
                      key={i}
                      className="w-5 h-5 rounded-full border border-black/15"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                </div>
              </div>

              <p className="mt-2.5 text-[11px] text-gray-600 leading-relaxed">{preset.description}</p>
            </div>
          );
        })}
      </div>

      {/* Custom Overrides & Typography */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-gray-200 bg-white rounded-md p-5 space-y-4 text-xs">
          <h2 className="text-sm font-semibold text-gray-900">Colour Palette Overrides (Optional)</h2>
          <p className="text-gray-500">Leave blank to inherit {activePreset.name} preset defaults.</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['primary_color', 'Primary Brand Colour', activePreset.palette.primary],
              ['secondary_color', 'Secondary Colour', activePreset.palette.secondary],
              ['background_color', 'Page Canvas Background', activePreset.palette.canvas],
              ['surface_color', 'Surface / Section Tint', activePreset.palette.surface],
              ['text_color', 'Body Text Ink', activePreset.palette.ink],
              ['accent_color', 'Accent / Highlight Colour', activePreset.palette.accent],
            ].map(([key, label, placeholderHex]) => {
              const val = (ov as any)[key] || '';
              return (
                <div key={key}>
                  <label className="block font-medium text-gray-700 mb-1">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={val || placeholderHex}
                      onChange={(e) => updateOverride(key, e.target.value)}
                      className="w-9 h-9 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      value={val}
                      onChange={(e) => updateOverride(key, e.target.value)}
                      placeholder={placeholderHex}
                      className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 font-mono"
                    />
                    {val && (
                      <button
                        type="button"
                        onClick={() => updateOverride(key, '')}
                        className="text-gray-400 hover:text-gray-800 cursor-pointer"
                        title="Reset to preset default"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border border-gray-200 bg-white rounded-md p-5 space-y-4 text-xs">
          <h2 className="text-sm font-semibold text-gray-900">Typography, Corners, Cards &amp; Motion</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-gray-700 mb-1">Heading Font</label>
              <select
                value={ov.heading_font || ''}
                onChange={(e) => updateOverride('heading_font', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-2"
              >
                <option value="">Theme Preset Default</option>
                {FONT_OPTIONS_ENGLISH.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Body Font</label>
              <select
                value={ov.body_font || ''}
                onChange={(e) => updateOverride('body_font', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-2"
              >
                <option value="">Theme Preset Default</option>
                {FONT_OPTIONS_ENGLISH.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Border Radius</label>
              <select
                value={ov.border_radius || ''}
                onChange={(e) => updateOverride('border_radius', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-2"
              >
                <option value="">Theme Preset Default</option>
                <option value="sharp">Sharp (0px Editorial)</option>
                <option value="soft">Soft (8px Retail)</option>
                <option value="rounded">Rounded (12px Friendly)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Button Style</label>
              <select
                value={ov.button_style || ''}
                onChange={(e) => updateOverride('button_style', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-2"
              >
                <option value="">Theme Preset Default</option>
                <option value="sharp">Sharp Square</option>
                <option value="soft">Soft Corners</option>
                <option value="rounded">Rounded Pill-Lite</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Product Card Style</label>
              <select
                value={ov.card_style || ''}
                onChange={(e) => updateOverride('card_style', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-2"
              >
                <option value="">Theme Preset Default</option>
                <option value="bordered">Clean Bordered</option>
                <option value="elevated">Soft Elevated Shadow</option>
                <option value="flat">Flat Structured</option>
                <option value="minimal">Borderless Gallery</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-1">Animation Intensity</label>
              <select
                value={ov.animation_intensity || 'subtle'}
                onChange={(e) => updateOverride('animation_intensity', e.target.value)}
                className="w-full border border-gray-300 rounded px-2.5 py-2"
              >
                <option value="subtle">Subtle (Recommended)</option>
                <option value="moderate">Moderate</option>
                <option value="minimal">Minimal / Instant</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminBrandingPage() {
  const { bootstrap, refreshBootstrap, notify } = useStore();
  const [form, setForm] = useState<BrandingSettings>({
    main_logo_url: '',
    light_logo_url: '',
    dark_logo_url: '',
    favicon_url: '',
    logo_width: 160,
    logo_height: 40,
    logo_alignment: 'left',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (bootstrap?.branding) {
      setForm({ ...bootstrap.branding });
    }
  }, [bootstrap?.branding]);

  const uploadAsset = async (field: 'main_logo_url' | 'light_logo_url' | 'dark_logo_url' | 'favicon_url', file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    fd.append('bucket', 'branding');
    try {
      const res = await apiFetch<{ url: string }>('/api/admin/upload', { method: 'POST', body: fd });
      setForm((prev) => ({ ...prev, [field]: res.url }));
      notify('Asset uploaded — click Save Branding to apply storefront-wide');
    } catch (err: any) {
      notify(err.message || 'Upload failed', 'error');
    }
  };

  const saveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings/branding', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          logo_width: Number(form.logo_width || 160),
          logo_height: Number(form.logo_height || 40),
        }),
      });
      await syncBrandingToFirestore(form as unknown as Record<string, unknown>);
      await refreshBootstrap();
      notify('Company logo & branding updated across header, footer, favicon & invoices');
    } catch (err: any) {
      notify(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={saveBranding} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Company Logo &amp; Brand Assets</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Supports PNG, SVG, WEBP, JPG, and ICO. Reflected automatically in Storefront Header, Footer, Browser Favicon, and PDF Invoices.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 bg-gray-900 text-white rounded text-xs font-medium cursor-pointer hover:bg-gray-800"
        >
          {saving ? 'Saving...' : 'Save Branding Settings'}
        </button>
      </div>

      {/* Live Preview */}
      <div className="border border-gray-200 bg-white rounded-md p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Live Header &amp; Dark Footer Preview</p>
        <div
          className={`border border-gray-200 rounded p-4 flex items-center bg-white ${
            form.logo_alignment === 'center' ? 'justify-center' : 'justify-start'
          }`}
        >
          {form.main_logo_url ? (
            <img
              src={form.main_logo_url}
              alt="Main Logo Preview"
              style={{ maxWidth: `${form.logo_width}px`, maxHeight: `${form.logo_height}px` }}
              className="object-contain"
            />
          ) : (
            <span className="font-semibold text-lg tracking-tight text-gray-900">ARORA GARMENTS</span>
          )}
        </div>
        <div className="border border-gray-800 rounded p-4 bg-gray-900 text-white flex items-center justify-between">
          {form.light_logo_url || form.main_logo_url ? (
            <img
              src={form.light_logo_url || form.main_logo_url}
              alt="Footer Logo Preview"
              style={{ maxWidth: `${form.logo_width}px`, maxHeight: `${form.logo_height}px` }}
              className="object-contain"
            />
          ) : (
            <span className="font-semibold text-lg tracking-tight">ARORA GARMENTS</span>
          )}
          <span className="text-[11px] text-gray-400">Footer Light/Dark Contrast Preview</span>
        </div>
      </div>

      {/* Logo Uploaders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {(
          [
            ['main_logo_url', 'Main Header & Invoice Logo', 'Used in storefront navigation header and printed PDF invoices.'],
            ['light_logo_url', 'Light Logo (For Dark Surfaces / Footer)', 'Optional light monochrome variant displayed on the dark footer.'],
            ['dark_logo_url', 'Dark Logo Variant', 'Optional dark monochrome variant for light backgrounds.'],
            ['favicon_url', 'Browser Favicon (ICO / PNG / SVG)', 'Displayed in browser tab and bookmarks.'],
          ] as const
        ).map(([field, title, hint]) => (
          <div key={field} className="border border-gray-200 bg-white rounded-md p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
                <p className="text-gray-500 mt-0.5">{hint}</p>
              </div>
              {form[field] && (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, [field]: '' }))}
                  className="text-rose-700 hover:text-rose-900 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>

            <div className="h-20 border border-dashed border-gray-300 rounded bg-gray-50 flex items-center justify-center p-2">
              {form[field] ? (
                <img src={form[field]} alt={title} className="max-h-16 max-w-full object-contain" />
              ) : (
                <div className="flex items-center gap-1.5 text-gray-400">
                  <ImageIcon className="w-4 h-4" />
                  <span>No asset uploaded</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-900 rounded font-medium cursor-pointer hover:bg-gray-50 shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{form[field] ? 'Replace' : 'Upload File'}</span>
                <input
                  type="file"
                  accept="image/*,.ico,.svg"
                  className="hidden"
                  onChange={(e) => uploadAsset(field, e.target.files?.[0])}
                />
              </label>
              <input
                value={form[field]}
                onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                placeholder="Or paste image URL (/uploads/...)"
                className="flex-1 border border-gray-300 rounded px-2.5 py-2 font-mono"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Sizing & Alignment */}
      <div className="border border-gray-200 bg-white rounded-md p-5 space-y-4 text-xs">
        <h2 className="text-sm font-semibold text-gray-900">Logo Sizing &amp; Header Alignment</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium text-gray-700 mb-1">Max Logo Width (px)</label>
            <input
              type="number"
              min={60}
              max={320}
              value={form.logo_width}
              onChange={(e) => setForm((prev) => ({ ...prev, logo_width: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded px-3 py-2 tabular-nums"
            />
          </div>
          <div>
            <label className="block font-medium text-gray-700 mb-1">Max Logo Height (px)</label>
            <input
              type="number"
              min={20}
              max={100}
              value={form.logo_height}
              onChange={(e) => setForm((prev) => ({ ...prev, logo_height: Number(e.target.value) }))}
              className="w-full border border-gray-300 rounded px-3 py-2 tabular-nums"
            />
          </div>
          <div>
            <label className="block font-medium text-gray-700 mb-1">Desktop Header Alignment</label>
            <select
              value={form.logo_alignment}
              onChange={(e) => setForm((prev) => ({ ...prev, logo_alignment: e.target.value as 'left' | 'center' }))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="left">Left Aligned (Classic Retail)</option>
              <option value="center">Centered Logo Layout</option>
            </select>
          </div>
        </div>
      </div>
    </form>
  );
}

export function AdminShippingZonesPage() {
  const { refreshBootstrap, notify } = useStore();
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [form, setForm] = useState({
    pincode: '',
    town_name: '',
    area_name: '',
    city: 'Bulandshahr',
    state: 'Uttar Pradesh',
    radius_km: 15,
    min_order_value: 0,
    delivery_fee: 50,
    free_delivery_above: 1499,
    estimated_days: '1-2 Days',
    cod_allowed: true,
    is_active: true,
    notes: '',
  });

  const load = () => {
    apiFetch<{ pincodes: DeliveryZone[] }>('/api/admin/pincodes').then((r) => setZones(r.pincodes));
  };

  useEffect(load, []);

  const saveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/pincodes', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      notify(`Delivery zone ${form.pincode} (${form.town_name || form.area_name}) saved`);
      setForm({
        pincode: '',
        town_name: '',
        area_name: '',
        city: 'Bulandshahr',
        state: 'Uttar Pradesh',
        radius_km: 15,
        min_order_value: 0,
        delivery_fee: 50,
        free_delivery_above: 1499,
        estimated_days: '1-2 Days',
        cod_allowed: true,
        is_active: true,
        notes: '',
      });
      load();
      refreshBootstrap();
    } catch (err: any) {
      notify(err.message || 'Could not save zone', 'error');
    }
  };

  const editZone = (z: DeliveryZone) => {
    setForm({
      pincode: z.pincode,
      town_name: z.town_name || '',
      area_name: z.area_name || '',
      city: z.city || 'Bulandshahr',
      state: z.state || 'Uttar Pradesh',
      radius_km: z.radius_km ?? 15,
      min_order_value: z.min_order_value ?? 0,
      delivery_fee: z.delivery_fee ?? 0,
      free_delivery_above: z.free_delivery_above ?? 0,
      estimated_days: z.estimated_days || '1-2 Days',
      cod_allowed: Boolean(z.cod_allowed),
      is_active: Boolean(z.is_active),
      notes: z.notes || '',
    });
  };

  const deleteZone = async (pincode: string) => {
    await apiFetch(`/api/admin/pincodes/${pincode}`, { method: 'DELETE' });
    notify(`Removed PIN ${pincode}`);
    load();
    refreshBootstrap();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Bulandshahr &amp; Nearby Local Delivery Zones</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage 20–30 km regional PIN zones, minimum order thresholds, delivery fees, ETA, and Cash on Delivery eligibility. Orders outside these PIN codes automatically offer Pan-India WhatsApp Checkout.
        </p>
      </div>

      <form onSubmit={saveZone} className="border border-gray-200 bg-white rounded-md p-5 space-y-4 text-xs">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <MapPin className="w-4 h-4" />
          <span>Add or Update Serviceable PIN Zone</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block font-medium mb-1">PIN Code (6 digits) *</label>
            <input required maxLength={6} value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="203205" className="w-full border border-gray-300 rounded px-2.5 py-2 tabular-nums font-mono" />
          </div>
          <div>
            <label className="block font-medium mb-1">Town / Locality *</label>
            <input required value={form.town_name} onChange={(e) => setForm({ ...form, town_name: e.target.value })} placeholder="Sikandrabad" className="w-full border border-gray-300 rounded px-2.5 py-2" />
          </div>
          <div>
            <label className="block font-medium mb-1">Area Label *</label>
            <input required value={form.area_name} onChange={(e) => setForm({ ...form, area_name: e.target.value })} placeholder="Sikandrabad Town & Highway" className="w-full border border-gray-300 rounded px-2.5 py-2" />
          </div>
          <div>
            <label className="block font-medium mb-1">Distance Radius (km)</label>
            <input type="number" min={0} max={100} value={form.radius_km} onChange={(e) => setForm({ ...form, radius_km: Number(e.target.value) })} className="w-full border border-gray-300 rounded px-2.5 py-2 tabular-nums" />
          </div>
          <div>
            <label className="block font-medium mb-1">Delivery Fee (₹)</label>
            <input type="number" min={0} value={form.delivery_fee} onChange={(e) => setForm({ ...form, delivery_fee: Number(e.target.value) })} className="w-full border border-gray-300 rounded px-2.5 py-2 tabular-nums" />
          </div>
          <div>
            <label className="block font-medium mb-1">Free Delivery Above (₹)</label>
            <input type="number" min={0} value={form.free_delivery_above} onChange={(e) => setForm({ ...form, free_delivery_above: Number(e.target.value) })} className="w-full border border-gray-300 rounded px-2.5 py-2 tabular-nums" />
          </div>
          <div>
            <label className="block font-medium mb-1">Min Order Value (₹)</label>
            <input type="number" min={0} value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: Number(e.target.value) })} className="w-full border border-gray-300 rounded px-2.5 py-2 tabular-nums" />
          </div>
          <div>
            <label className="block font-medium mb-1">Estimated Delivery ETA</label>
            <input value={form.estimated_days} onChange={(e) => setForm({ ...form, estimated_days: e.target.value })} placeholder="1-2 Days" className="w-full border border-gray-300 rounded px-2.5 py-2" />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-medium mb-1">Delivery Notes</label>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Local dispatch notes" className="w-full border border-gray-300 rounded px-2.5 py-2" />
          </div>
          <div className="flex items-center gap-4 pt-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.cod_allowed} onChange={(e) => setForm({ ...form, cod_allowed: e.target.checked })} />
              <span>COD Allowed</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <span>Active</span>
            </label>
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full py-2.5 bg-gray-900 text-white rounded font-medium cursor-pointer">
              Save Delivery Zone
            </button>
          </div>
        </div>
      </form>

      <div className="border border-gray-200 bg-white rounded-md overflow-x-auto">
        <table className="w-full text-xs text-left tabular-nums">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <th className="p-3">PIN</th>
              <th className="p-3">Town &amp; Area</th>
              <th className="p-3">Radius</th>
              <th className="p-3">Fee / Free Above</th>
              <th className="p-3">Min Order</th>
              <th className="p-3">ETA / COD</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {zones.map((z) => (
              <tr key={z.pincode} className="hover:bg-gray-50">
                <td className="p-3 font-mono font-semibold text-gray-900">{z.pincode}</td>
                <td className="p-3">
                  <p className="font-medium text-gray-900">{z.town_name || z.area_name}</p>
                  <p className="text-gray-500">{z.area_name}</p>
                </td>
                <td className="p-3">{z.radius_km ?? 25} km</td>
                <td className="p-3">
                  {z.delivery_fee === 0 ? 'Free' : formatINR(z.delivery_fee)}
                  {z.free_delivery_above ? <span className="text-gray-500"> (Free &gt; {formatINR(z.free_delivery_above)})</span> : null}
                </td>
                <td className="p-3">{z.min_order_value ? formatINR(z.min_order_value) : 'None'}</td>
                <td className="p-3">
                  <p>{z.estimated_days}</p>
                  <p className="text-gray-500">{z.cod_allowed ? 'COD + UPI' : 'UPI Only'}</p>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] border ${z.is_active ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {z.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button type="button" onClick={() => editZone(z)} className="underline text-gray-900 cursor-pointer">Edit</button>
                  <button type="button" onClick={() => deleteZone(z.pincode)} className="underline text-rose-700 cursor-pointer">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
