import { THEME_PRESETS } from '@fastio/shared'

export const themePresets = THEME_PRESETS.map((p) => ({
  value: p.name,
  label: p.label,
  palette: p.palette,
}))

export const fontOptions = [
  { value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: 'Системный (по умолчанию)' },
  { value: '"Inter", sans-serif', label: 'Inter' },
  { value: '"Nunito", sans-serif', label: 'Nunito' },
  { value: '"Montserrat", sans-serif', label: 'Montserrat' },
]
