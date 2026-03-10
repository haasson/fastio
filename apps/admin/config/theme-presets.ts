import type { TenantThemePreset } from '@fastio/shared'

export const themePresets: { value: TenantThemePreset; label: string; preview: string }[] = [
  { value: 'light', label: 'Светлая', preview: '#f7f7f8' },
  { value: 'dark', label: 'Тёмная', preview: '#141414' },
  { value: 'warm', label: 'Тёплая', preview: '#fdf6f0' },
  { value: 'minimal', label: 'Минимал', preview: '#ffffff' },
]

export const fontOptions = [
  { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: 'Системный (по умолчанию)' },
  { value: '"Inter", sans-serif', label: 'Inter' },
  { value: '"Nunito", sans-serif', label: 'Nunito' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat' },
]
