import type { TenantThemePreset } from '@fastio/shared'

export const themePresets: { value: TenantThemePreset; label: string; preview: string }[] = [
  { value: 'fresh', label: '🍊 Fresh', preview: '#ffffff' },
  { value: 'dark', label: '🌑 Dark', preview: '#2d1208' },
  { value: 'forest', label: '🌲 Forest', preview: '#0f1f14' },
  { value: 'sakura', label: '🌸 Sakura', preview: '#fff5f9' },
  { value: 'slate', label: '🪨 Slate', preview: '#0f172a' },
  { value: 'cream', label: '🧈 Cream', preview: '#fdf8f0' },
  { value: 'neon', label: '⚡ Neon', preview: '#08000f' },
  { value: 'sunset', label: '🌅 Sunset', preview: '#1a0a2e' },
  { value: 'ocean', label: '🌊 Ocean', preview: '#040d1a' },
  { value: 'lemon', label: '🍋 Lemon', preview: '#fffff0' },
]

export const fontOptions = [
  { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: 'Системный (по умолчанию)' },
  { value: '"Inter", sans-serif', label: 'Inter' },
  { value: '"Nunito", sans-serif', label: 'Nunito' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat' },
]
