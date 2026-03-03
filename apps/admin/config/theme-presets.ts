import type { TenantTheme } from '@fastio/shared'

export const themePresets: { value: TenantTheme['preset']; label: string; color: string }[] = [
  { value: 'default', label: 'Оранжевый', color: '#ff6b35' },
  { value: 'dark', label: 'Тёмный', color: '#1a1a2e' },
  { value: 'warm', label: 'Красный', color: '#dc2626' },
  { value: 'minimal', label: 'Минимал', color: '#111111' },
]

export const fontOptions = [
  { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: 'Системный (по умолчанию)' },
  { value: '"Inter", sans-serif', label: 'Inter' },
  { value: '"Nunito", sans-serif', label: 'Nunito' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat' },
]
