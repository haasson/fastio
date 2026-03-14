import { THEME_PRESETS } from '@fastio/shared'
import { GOOGLE_FONTS, FONT_CATEGORY_LABELS, SYSTEM_FONT_VALUE } from './google-fonts'

export const themePresets = THEME_PRESETS.map((p) => ({
  value: p.name,
  label: p.label,
  palette: p.palette,
}))

const systemOption = { value: SYSTEM_FONT_VALUE, label: 'Системный (по умолчанию)' }

const uniqueFonts = GOOGLE_FONTS.filter(
  (font, index, self) => self.findIndex((f) => f.family === font.family) === index,
)

const groupedFonts = Object.entries(FONT_CATEGORY_LABELS).map(([category, label]) => ({
  type: 'group' as const,
  label,
  key: category,
  children: uniqueFonts
    .filter((f) => f.category === category)
    .map((f) => ({ value: f.family, label: f.family })),
}))

export const fontOptions = [systemOption, ...groupedFonts]
