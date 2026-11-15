import type { AppearanceSettings } from '../types';

export interface ThemePreset {
  id:
    | 'modern-classic'
    | 'premium-luxury'
    | 'urban-streetwear'
    | 'festive-ethnic'
    | 'family-fashion'
    | 'editorial-minimal';
  name: string;
  tagline: string;
  description: string;
  category: string;
  palette: {
    canvas: string;
    surface: string;
    card: string;
    ink: string;
    muted: string;
    border: string;
    primary: string;
    secondary: string;
    accent: string;
    buttonBg: string;
    buttonText: string;
    badgeBg: string;
    badgeText: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    headingWeight: string;
  };
  layout: {
    radius: string;
    buttonRadius: string;
    cardBorder: string;
    cardShadow: string;
    heroOverlay: string;
  };
  animationIntensity: 'subtle' | 'moderate' | 'minimal';
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'modern-classic',
    name: 'Modern Classic',
    tagline: 'Clean monochrome retail clarity',
    description: 'High-contrast white and charcoal retail structure built for fast browsing, crisp product cards, and trusted everyday Indian shopping.',
    category: 'Default Retail',
    palette: {
      canvas: '#FFFFFF',
      surface: '#F6F7F8',
      card: '#FFFFFF',
      ink: '#111827',
      muted: '#525866',
      border: '#E5E7EB',
      primary: '#111827',
      secondary: '#374151',
      accent: '#B45309',
      buttonBg: '#111827',
      buttonText: '#FFFFFF',
      badgeBg: '#F3F4F6',
      badgeText: '#111827',
    },
    typography: {
      headingFont: '"Poppins", "Inter", sans-serif',
      bodyFont: '"Inter", -apple-system, sans-serif',
      headingWeight: '600',
    },
    layout: {
      radius: '6px',
      buttonRadius: '6px',
      cardBorder: '1px solid #E5E7EB',
      cardShadow: '0 1px 2px rgba(17, 24, 39, 0.04)',
      heroOverlay: 'linear-gradient(90deg, rgba(17,24,39,0.72) 0%, rgba(17,24,39,0.32) 55%, rgba(17,24,39,0.08) 100%)',
    },
    animationIntensity: 'subtle',
  },
  {
    id: 'premium-luxury',
    name: 'Premium Luxury',
    tagline: 'Warm ivory, deep espresso & antique gold',
    description: 'Elevated occasionwear and boutique tailoring aesthetic pairing warm alabaster surfaces with espresso typography and muted antique gold highlights.',
    category: 'Boutique & Occasion',
    palette: {
      canvas: '#FAF8F4',
      surface: '#F2ECE1',
      card: '#FFFFFF',
      ink: '#1C1917',
      muted: '#6B6257',
      border: '#E4DAC9',
      primary: '#292018',
      secondary: '#5C4A38',
      accent: '#9A6B2F',
      buttonBg: '#292018',
      buttonText: '#FAF8F4',
      badgeBg: '#F5EFE3',
      badgeText: '#785020',
    },
    typography: {
      headingFont: '"Manrope", "Poppins", sans-serif',
      bodyFont: '"Inter", sans-serif',
      headingWeight: '600',
    },
    layout: {
      radius: '2px',
      buttonRadius: '2px',
      cardBorder: '1px solid #E4DAC9',
      cardShadow: '0 4px 18px rgba(41, 32, 24, 0.05)',
      heroOverlay: 'linear-gradient(90deg, rgba(28,25,23,0.78) 0%, rgba(28,25,23,0.40) 55%, rgba(28,25,23,0.12) 100%)',
    },
    animationIntensity: 'subtle',
  },
  {
    id: 'urban-streetwear',
    name: 'Urban Streetwear',
    tagline: 'Bold ink, slate surfaces & signal indigo',
    description: 'Youthful denim, oversized tees, casual shirts, and sneakers presented on sharp cool-grey cards with decisive high-contrast buttons.',
    category: 'Denim & Casual',
    palette: {
      canvas: '#F8FAFC',
      surface: '#EEF2F6',
      card: '#FFFFFF',
      ink: '#0F172A',
      muted: '#475569',
      border: '#CBD5E1',
      primary: '#0F172A',
      secondary: '#1E293B',
      accent: '#DC2626',
      buttonBg: '#0F172A',
      buttonText: '#FFFFFF',
      badgeBg: '#E2E8F0',
      badgeText: '#0F172A',
    },
    typography: {
      headingFont: '"Poppins", sans-serif',
      bodyFont: '"Manrope", "Inter", sans-serif',
      headingWeight: '700',
    },
    layout: {
      radius: '0px',
      buttonRadius: '0px',
      cardBorder: '1px solid #CBD5E1',
      cardShadow: '0 2px 0 rgba(15, 23, 42, 0.06)',
      heroOverlay: 'linear-gradient(90deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.45) 55%, rgba(15,23,42,0.12) 100%)',
    },
    animationIntensity: 'moderate',
  },
  {
    id: 'festive-ethnic',
    name: 'Festive Ethnic',
    tagline: 'Maroon heritage, warm sandalwood & celebration gold',
    description: 'Designed for Indian wedding season, kurta pajamas, ethnic tops, and festive family shopping in Bulandshahr and across UP.',
    category: 'Wedding & Festive',
    palette: {
      canvas: '#FFFBF7',
      surface: '#FBF1E6',
      card: '#FFFFFF',
      ink: '#2A1815',
      muted: '#6E554F',
      border: '#EAD6C3',
      primary: '#6D1D26',
      secondary: '#8C3B2B',
      accent: '#B45309',
      buttonBg: '#6D1D26',
      buttonText: '#FFFBF7',
      badgeBg: '#F9E8D9',
      badgeText: '#6D1D26',
    },
    typography: {
      headingFont: '"Poppins", "Hind", sans-serif',
      bodyFont: '"Inter", "Hind", sans-serif',
      headingWeight: '600',
    },
    layout: {
      radius: '8px',
      buttonRadius: '6px',
      cardBorder: '1px solid #EAD6C3',
      cardShadow: '0 6px 20px rgba(109, 29, 38, 0.06)',
      heroOverlay: 'linear-gradient(90deg, rgba(58,15,20,0.78) 0%, rgba(58,15,20,0.42) 55%, rgba(58,15,20,0.10) 100%)',
    },
    animationIntensity: 'subtle',
  },
  {
    id: 'family-fashion',
    name: 'Family Fashion',
    tagline: 'Approachable navy, soft cream & friendly cards',
    description: 'Warm, trustworthy multi-department retail theme tailored for families shopping together across Men’s, Women’s, Kids & Footwear.',
    category: 'Family Store',
    palette: {
      canvas: '#F9FAFB',
      surface: '#EFF4F9',
      card: '#FFFFFF',
      ink: '#1E293B',
      muted: '#55657A',
      border: '#DCE5F0',
      primary: '#1E3A5F',
      secondary: '#2B5182',
      accent: '#D97706',
      buttonBg: '#1E3A5F',
      buttonText: '#FFFFFF',
      badgeBg: '#E6EEF7',
      badgeText: '#1E3A5F',
    },
    typography: {
      headingFont: '"Manrope", "Inter", sans-serif',
      bodyFont: '"Inter", sans-serif',
      headingWeight: '700',
    },
    layout: {
      radius: '10px',
      buttonRadius: '8px',
      cardBorder: '1px solid #DCE5F0',
      cardShadow: '0 4px 14px rgba(30, 58, 95, 0.06)',
      heroOverlay: 'linear-gradient(90deg, rgba(20,40,68,0.76) 0%, rgba(20,40,68,0.36) 55%, rgba(20,40,68,0.10) 100%)',
    },
    animationIntensity: 'subtle',
  },
  {
    id: 'editorial-minimal',
    name: 'Editorial Minimal',
    tagline: 'Gallery stone, whisper-thin rules & spacious type',
    description: 'Ultra-clean lookbook presentation removing heavy borders so garment silhouettes, fabrics, and colourways take center stage.',
    category: 'Lookbook & Studio',
    palette: {
      canvas: '#FCFCFB',
      surface: '#F4F4F1',
      card: '#FCFCFB',
      ink: '#18181B',
      muted: '#63636B',
      border: '#E4E4E7',
      primary: '#18181B',
      secondary: '#3F3F46',
      accent: '#52525B',
      buttonBg: '#18181B',
      buttonText: '#FFFFFF',
      badgeBg: '#F4F4F5',
      badgeText: '#27272A',
    },
    typography: {
      headingFont: '"Manrope", "Inter", sans-serif',
      bodyFont: '"Inter", sans-serif',
      headingWeight: '500',
    },
    layout: {
      radius: '0px',
      buttonRadius: '0px',
      cardBorder: '1px solid transparent',
      cardShadow: 'none',
      heroOverlay: 'linear-gradient(90deg, rgba(24,24,27,0.68) 0%, rgba(24,24,27,0.28) 55%, rgba(24,24,27,0.05) 100%)',
    },
    animationIntensity: 'minimal',
  },
];

export const FONT_OPTIONS_ENGLISH = [
  { label: 'Inter (Default Retail)', value: '"Inter", -apple-system, sans-serif' },
  { label: 'Poppins (Modern Bold)', value: '"Poppins", "Inter", sans-serif' },
  { label: 'Manrope (Clean Geometric)', value: '"Manrope", "Inter", sans-serif' },
];

export function getThemePreset(themeId?: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0];
}

export function applyThemeVariables(appearance?: AppearanceSettings | null) {
  if (typeof document === 'undefined') return;
  const preset = getThemePreset(appearance?.active_theme_id);
  const ov = appearance?.custom_overrides || {};

  const radius =
    ov.border_radius === 'sharp'
      ? '0px'
      : ov.border_radius === 'soft'
        ? '8px'
        : ov.border_radius === 'rounded'
          ? '12px'
          : preset.layout.radius;

  const buttonRadius =
    ov.button_style === 'sharp'
      ? '0px'
      : ov.button_style === 'rounded'
        ? '8px'
        : ov.button_style === 'soft'
          ? '6px'
          : preset.layout.buttonRadius;

  const cardShadow =
    ov.card_style === 'elevated'
      ? '0 8px 24px rgba(17, 24, 39, 0.08)'
      : ov.card_style === 'flat'
        ? 'none'
        : preset.layout.cardShadow;

  const cardBorder =
    ov.card_style === 'minimal'
      ? '1px solid transparent'
      : ov.card_style === 'bordered'
        ? `1px solid ${ov.secondary_color || preset.palette.border}`
        : preset.layout.cardBorder;

  const headingFont = ov.heading_font || preset.typography.headingFont;
  const bodyFont = ov.body_font || preset.typography.bodyFont;

  const root = document.documentElement;
  root.dataset.agTheme = preset.id;
  root.dataset.agMotion = ov.animation_intensity || preset.animationIntensity;

  root.style.setProperty('--ag-canvas', ov.background_color || preset.palette.canvas);
  root.style.setProperty('--ag-surface', ov.surface_color || preset.palette.surface);
  root.style.setProperty('--ag-card', preset.palette.card);
  root.style.setProperty('--ag-ink', ov.text_color || preset.palette.ink);
  root.style.setProperty('--ag-muted', preset.palette.muted);
  root.style.setProperty('--ag-border', preset.palette.border);
  root.style.setProperty('--ag-primary', ov.primary_color || preset.palette.primary);
  root.style.setProperty('--ag-secondary', ov.secondary_color || preset.palette.secondary);
  root.style.setProperty('--ag-accent', ov.accent_color || preset.palette.accent);
  root.style.setProperty('--ag-btn-bg', ov.primary_color || preset.palette.buttonBg);
  root.style.setProperty('--ag-btn-text', preset.palette.buttonText);
  root.style.setProperty('--ag-badge-bg', preset.palette.badgeBg);
  root.style.setProperty('--ag-badge-text', preset.palette.badgeText);
  root.style.setProperty('--ag-radius', radius);
  root.style.setProperty('--ag-btn-radius', buttonRadius);
  root.style.setProperty('--ag-card-border', cardBorder);
  root.style.setProperty('--ag-card-shadow', cardShadow);
  root.style.setProperty('--ag-hero-overlay', preset.layout.heroOverlay);
  root.style.setProperty('--ag-font-heading', headingFont);
  root.style.setProperty('--ag-font-body', bodyFont);
  root.style.setProperty('--ag-heading-weight', preset.typography.headingWeight);
}
