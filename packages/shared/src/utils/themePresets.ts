import type { TenantThemePreset, ThemePalette } from '../types/tenant'

export type ThemePresetDef = {
  name: TenantThemePreset
  label: string
  palette: ThemePalette
}

export const THEME_PRESETS: ThemePresetDef[] = [
  {
    name: 'fresh',
    label: 'Fresh',
    palette: {
      primary: '#ff6b35',
      bg: '#ffffff',
      surface: '#f5f5f5',
      text: '#111111',
      textSecondary: '#666666',
      textMuted: '#999999',
      border: '#e0e0e0',
    },
  },
  {
    name: 'dark',
    label: 'Dark',
    palette: {
      primary: '#ff6b35',
      bg: '#2d1208',
      surface: '#3d1a0e',
      text: '#f5ede8',
      textSecondary: '#c4a090',
      textMuted: '#8a6055',
      border: '#4d2418',
    },
  },
  {
    name: 'forest',
    label: 'Forest',
    palette: {
      primary: '#4ade80',
      bg: '#0f1f14',
      surface: '#172a1c',
      text: '#e8f5ec',
      textSecondary: '#8db89a',
      textMuted: '#5a7d65',
      border: '#243d2b',
    },
  },
  {
    name: 'sakura',
    label: 'Sakura',
    palette: {
      primary: '#e91e8c',
      bg: '#fff5f9',
      surface: '#ffeef5',
      text: '#2d0a1a',
      textSecondary: '#7a3a57',
      textMuted: '#b07090',
      border: '#f5d0e3',
    },
  },
  {
    name: 'slate',
    label: 'Slate',
    palette: {
      primary: '#6366f1',
      bg: '#0f172a',
      surface: '#1e293b',
      text: '#f1f5f9',
      textSecondary: '#94a3b8',
      textMuted: '#64748b',
      border: '#334155',
    },
  },
  {
    name: 'cream',
    label: 'Cream',
    palette: {
      primary: '#c2783a',
      bg: '#fdf8f0',
      surface: '#f5ede0',
      text: '#2c1a08',
      textSecondary: '#7a5535',
      textMuted: '#b08060',
      border: '#e8d5bc',
    },
  },
  {
    name: 'neon',
    label: 'Neon',
    palette: {
      primary: '#ff2d78',
      bg: '#08000f',
      surface: '#12001f',
      text: '#ffffff',
      textSecondary: '#cc88ff',
      textMuted: '#7744aa',
      border: '#2a0044',
    },
  },
  {
    name: 'sunset',
    label: 'Sunset',
    palette: {
      primary: '#f97316',
      bg: '#1a0a2e',
      surface: '#2d1045',
      text: '#fde8d8',
      textSecondary: '#c4909a',
      textMuted: '#8a5060',
      border: '#4a1a50',
    },
  },
  {
    name: 'ocean',
    label: 'Ocean',
    palette: {
      primary: '#06b6d4',
      bg: '#040d1a',
      surface: '#0a1a2e',
      text: '#e0f4ff',
      textSecondary: '#7ab8d4',
      textMuted: '#4a7a94',
      border: '#0f2a3d',
    },
  },
  {
    name: 'lemon',
    label: 'Lemon',
    palette: {
      primary: '#eab308',
      bg: '#fffff0',
      surface: '#fefce8',
      text: '#1a1400',
      textSecondary: '#6b5800',
      textMuted: '#a07800',
      border: '#fde047',
    },
  },
  {
    name: 'ember',
    label: 'Ember',
    palette: {
      primary: '#E8622A',
      bg: '#1A1410',
      surface: '#261D17',
      text: '#F5EBE0',
      textSecondary: '#C9A882',
      textMuted: '#7A6152',
      border: '#3D2E24',
    },
  },
  {
    name: 'garden',
    label: 'Garden',
    palette: {
      primary: '#3E8C4B',
      bg: '#F7F4EF',
      surface: '#FFFFFF',
      text: '#1E2B1A',
      textSecondary: '#4A5E44',
      textMuted: '#9AAB8E',
      border: '#DDE5D8',
    },
  },
  {
    name: 'midnight',
    label: 'Midnight',
    palette: {
      primary: '#E8AC34',
      bg: '#0E0F14',
      surface: '#16171F',
      text: '#EEEDF2',
      textSecondary: '#9E9DAD',
      textMuted: '#52505E',
      border: '#24242F',
    },
  },
  {
    name: 'berry',
    label: 'Berry',
    palette: {
      primary: '#C0324F',
      bg: '#FDF5F7',
      surface: '#FFFFFF',
      text: '#2A1520',
      textSecondary: '#6B3A4E',
      textMuted: '#B8879A',
      border: '#F0DCE3',
    },
  },
  {
    name: 'fiesta',
    label: 'Fiesta',
    palette: {
      primary: '#E84545',
      bg: '#FAF7F2',
      surface: '#FFFFFF',
      text: '#1C1814',
      textSecondary: '#5C5248',
      textMuted: '#A89E94',
      border: '#EAE4DC',
    },
  },
]

export const getPresetPalette = (name: string): ThemePalette | null =>
  THEME_PRESETS.find(p => p.name === name)?.palette ?? null

export const paletteToCssVars = (p: ThemePalette): Record<string, string> => ({
  '--primary': p.primary,
  '--color-bg': p.bg,
  '--color-surface': p.surface,
  '--color-text': p.text,
  '--color-text-secondary': p.textSecondary,
  '--color-text-muted': p.textMuted,
  '--color-border': p.border,
})
