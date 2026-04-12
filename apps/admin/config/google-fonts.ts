export type GoogleFontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace'

export type GoogleFont = {
  family: string
  category: GoogleFontCategory
}

export const GOOGLE_FONTS: GoogleFont[] = [
  // Sans-serif
  { family: 'Roboto', category: 'sans-serif' },
  { family: 'Open Sans', category: 'sans-serif' },
  { family: 'Noto Sans', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Nunito Sans', category: 'sans-serif' },
  { family: 'Ubuntu', category: 'sans-serif' },
  { family: 'Oswald', category: 'sans-serif' },
  { family: 'Rubik', category: 'sans-serif' },
  { family: 'Mulish', category: 'sans-serif' },
  { family: 'Fira Sans', category: 'sans-serif' },
  { family: 'Exo 2', category: 'sans-serif' },
  { family: 'Jost', category: 'sans-serif' },
  { family: 'Manrope', category: 'sans-serif' },
  { family: 'Source Sans 3', category: 'sans-serif' },
  { family: 'PT Sans', category: 'sans-serif' },
  { family: 'IBM Plex Sans', category: 'sans-serif' },
  { family: 'Overpass', category: 'sans-serif' },
  { family: 'Arimo', category: 'sans-serif' },
  { family: 'Onest', category: 'sans-serif' },
  { family: 'Golos Text', category: 'sans-serif' },
  { family: 'Geologica', category: 'sans-serif' },
  { family: 'Comfortaa', category: 'sans-serif' },
  { family: 'Cuprum', category: 'sans-serif' },
  { family: 'Scada', category: 'sans-serif' },
  { family: 'Tenor Sans', category: 'sans-serif' },

  // Serif
  { family: 'Merriweather', category: 'serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'PT Serif', category: 'serif' },
  { family: 'Noto Serif', category: 'serif' },
  { family: 'EB Garamond', category: 'serif' },
  { family: 'Bitter', category: 'serif' },
  { family: 'Source Serif 4', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },
  { family: 'IBM Plex Serif', category: 'serif' },
  { family: 'Spectral', category: 'serif' },
  { family: 'Vollkorn', category: 'serif' },
  { family: 'Philosopher', category: 'serif' },
  { family: 'Oranienbaum', category: 'serif' },

  // Display
  { family: 'Russo One', category: 'display' },
  { family: 'Yeseva One', category: 'display' },
  { family: 'Unbounded', category: 'display' },
  { family: 'Syne', category: 'display' },

  // Handwriting
  { family: 'Caveat', category: 'handwriting' },
  { family: 'Bad Script', category: 'handwriting' },
  { family: 'Neucha', category: 'handwriting' },
  { family: 'Marck Script', category: 'handwriting' },

  // Monospace
  { family: 'JetBrains Mono', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
  { family: 'Roboto Mono', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'IBM Plex Mono', category: 'monospace' },
]

export const FONT_CATEGORY_LABELS: Record<GoogleFontCategory, string> = {
  'sans-serif': 'Рубленые (Sans-serif)',
  'serif': 'С засечками (Serif)',
  'display': 'Декоративные (Display)',
  'handwriting': 'Рукописные',
  'monospace': 'Моноширинные',
}

export const SYSTEM_FONT_VALUE = 'system'

/** Определяет, является ли сохранённое значение Google-шрифтом (новый формат — просто имя) */
export const isGoogleFontValue = (value: string): boolean => !!value && value !== SYSTEM_FONT_VALUE && !value.includes(',') && !value.startsWith('-') && !value.startsWith('"')

/** Преобразует имя шрифта в CSS-строку font-family */
export const fontFamilyCSS = (value: string): string => {
  if (!isGoogleFontValue(value)) {
    return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }

  return `"${value}", sans-serif`
}

/** Строит URL для подключения шрифта из Google Fonts */
export const googleFontUrl = (family: string, weights = '400;500;600;700'): string => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights}&display=swap`

/** Строит батч-URL для одновременной загрузки нескольких Google Fonts */
export const googleFontsBatchUrl = (families: string[], weights = '400;500;600;700'): string => {
  const params = families.map((f) => `family=${encodeURIComponent(f)}:wght@${weights}`).join('&')

  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}
