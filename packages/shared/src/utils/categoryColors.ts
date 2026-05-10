export type CategoryColorPreset = {
  key: string
  hex: string
}

// Дефолтный цвет, когда у категории не выбран свой (или категория услуги недоступна).
// Должен совпадать с одним из ключей CATEGORY_COLOR_PALETTE — иначе разъедется UI.
export const DEFAULT_CATEGORY_COLOR_KEY = 'indigo'

export const CATEGORY_COLOR_PALETTE: CategoryColorPreset[] = [
  { key: 'red',     hex: '#ef4444' },
  { key: 'coral',   hex: '#f97066' },
  { key: 'orange',  hex: '#f97316' },
  { key: 'amber',   hex: '#f59e0b' },
  { key: 'yellow',  hex: '#eab308' },
  { key: 'lime',    hex: '#84cc16' },
  { key: 'green',   hex: '#22c55e' },
  { key: 'emerald', hex: '#10b981' },
  { key: 'forest',  hex: '#15803d' },
  { key: 'teal',    hex: '#14b8a6' },
  { key: 'cyan',    hex: '#06b6d4' },
  { key: 'sky',     hex: '#0ea5e9' },
  { key: 'blue',    hex: '#3b82f6' },
  { key: 'navy',    hex: '#1d4ed8' },
  { key: 'indigo',  hex: '#6366f1' },
  { key: 'violet',  hex: '#8b5cf6' },
  { key: 'purple',  hex: '#a855f7' },
  { key: 'mauve',   hex: '#c084fc' },
  { key: 'fuchsia', hex: '#d946ef' },
  { key: 'pink',    hex: '#ec4899' },
  { key: 'rose',    hex: '#f43f5e' },
  { key: 'wine',    hex: '#be185d' },
  { key: 'slate',   hex: '#64748b' },
  { key: 'stone',   hex: '#78716c' },
]

export const getCategoryColorHex = (colorKey: string | null | undefined): string | null => {
  if (!colorKey) return null
  const preset = CATEGORY_COLOR_PALETTE.find((p) => p.key === colorKey)

  return preset?.hex ?? (colorKey.startsWith('#') ? colorKey : null)
}

export const DEFAULT_CATEGORY_COLOR_HEX
  = CATEGORY_COLOR_PALETTE.find((p) => p.key === DEFAULT_CATEGORY_COLOR_KEY)?.hex
    ?? CATEGORY_COLOR_PALETTE[0].hex

// Возвращает hex первого свободного цвета из палитры.
// usedColors — массив hex-значений (или ключей — getCategoryColorHex делает оба варианта).
export const getNextCategoryColor = (usedColors: (string | null)[]): string => {
  const usedHexes = new Set(
    usedColors
      .filter((c): c is string => !!c)
      .map((c) => getCategoryColorHex(c) ?? c),
  )
  const free = CATEGORY_COLOR_PALETTE.find((p) => !usedHexes.has(p.hex))

  return free?.hex ?? CATEGORY_COLOR_PALETTE[0].hex
}
