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
  { family: 'Lato', category: 'sans-serif' },
  { family: 'Montserrat', category: 'sans-serif' },
  { family: 'Poppins', category: 'sans-serif' },
  { family: 'Inter', category: 'sans-serif' },
  { family: 'Raleway', category: 'sans-serif' },
  { family: 'Nunito', category: 'sans-serif' },
  { family: 'Ubuntu', category: 'sans-serif' },
  { family: 'Oswald', category: 'sans-serif' },
  { family: 'Rubik', category: 'sans-serif' },
  { family: 'Work Sans', category: 'sans-serif' },
  { family: 'Mulish', category: 'sans-serif' },
  { family: 'Fira Sans', category: 'sans-serif' },
  { family: 'Quicksand', category: 'sans-serif' },
  { family: 'Barlow', category: 'sans-serif' },
  { family: 'Titillium Web', category: 'sans-serif' },
  { family: 'Exo 2', category: 'sans-serif' },
  { family: 'Jost', category: 'sans-serif' },
  { family: 'DM Sans', category: 'sans-serif' },
  { family: 'Plus Jakarta Sans', category: 'sans-serif' },
  { family: 'Outfit', category: 'sans-serif' },
  { family: 'Karla', category: 'sans-serif' },
  { family: 'Manrope', category: 'sans-serif' },
  { family: 'Figtree', category: 'sans-serif' },
  { family: 'Nunito Sans', category: 'sans-serif' },
  { family: 'Lexend', category: 'sans-serif' },
  { family: 'Hind', category: 'sans-serif' },
  { family: 'Mukta', category: 'sans-serif' },
  { family: 'Source Sans 3', category: 'sans-serif' },
  { family: 'PT Sans', category: 'sans-serif' },
  { family: 'Noto Sans JP', category: 'sans-serif' },
  { family: 'Noto Sans KR', category: 'sans-serif' },
  { family: 'IBM Plex Sans', category: 'sans-serif' },
  { family: 'Cabin', category: 'sans-serif' },
  { family: 'Overpass', category: 'sans-serif' },
  { family: 'Varela Round', category: 'sans-serif' },
  { family: 'Muli', category: 'sans-serif' },
  { family: 'Josefin Sans', category: 'sans-serif' },
  { family: 'Oxygen', category: 'sans-serif' },
  { family: 'Catamaran', category: 'sans-serif' },
  { family: 'Heebo', category: 'sans-serif' },
  { family: 'Arimo', category: 'sans-serif' },
  { family: 'Dosis', category: 'sans-serif' },
  { family: 'Asap', category: 'sans-serif' },
  { family: 'Yantramanav', category: 'sans-serif' },
  { family: 'Teko', category: 'sans-serif' },
  { family: 'Nanum Gothic', category: 'sans-serif' },
  { family: 'Acme', category: 'sans-serif' },
  { family: 'Kanit', category: 'sans-serif' },
  { family: 'Maven Pro', category: 'sans-serif' },
  { family: 'Prompt', category: 'sans-serif' },
  { family: 'Mada', category: 'sans-serif' },
  { family: 'Encode Sans', category: 'sans-serif' },
  { family: 'Barlow Condensed', category: 'sans-serif' },
  { family: 'Exo', category: 'sans-serif' },
  { family: 'Questrial', category: 'sans-serif' },
  { family: 'Urbanist', category: 'sans-serif' },
  { family: 'Red Hat Display', category: 'sans-serif' },
  { family: 'Sora', category: 'sans-serif' },
  { family: 'Be Vietnam Pro', category: 'sans-serif' },
  { family: 'Chivo', category: 'sans-serif' },
  { family: 'Space Grotesk', category: 'sans-serif' },
  { family: 'Albert Sans', category: 'sans-serif' },
  { family: 'Onest', category: 'sans-serif' },

  // Serif
  { family: 'Merriweather', category: 'serif' },
  { family: 'Playfair Display', category: 'serif' },
  { family: 'Lora', category: 'serif' },
  { family: 'PT Serif', category: 'serif' },
  { family: 'Noto Serif', category: 'serif' },
  { family: 'EB Garamond', category: 'serif' },
  { family: 'Libre Baskerville', category: 'serif' },
  { family: 'Crimson Text', category: 'serif' },
  { family: 'Bitter', category: 'serif' },
  { family: 'Source Serif 4', category: 'serif' },
  { family: 'Domine', category: 'serif' },
  { family: 'Cormorant Garamond', category: 'serif' },
  { family: 'Cardo', category: 'serif' },
  { family: 'Arvo', category: 'serif' },
  { family: 'Zilla Slab', category: 'serif' },
  { family: 'IBM Plex Serif', category: 'serif' },
  { family: 'Spectral', category: 'serif' },
  { family: 'Vollkorn', category: 'serif' },
  { family: 'Rokkitt', category: 'serif' },
  { family: 'Abril Fatface', category: 'serif' },
  { family: 'Josefin Slab', category: 'serif' },
  { family: 'Gloock', category: 'serif' },
  { family: 'DM Serif Display', category: 'serif' },
  { family: 'Young Serif', category: 'serif' },
  { family: 'Instrument Serif', category: 'serif' },

  // Display
  { family: 'Lobster', category: 'display' },
  { family: 'Pacifico', category: 'display' },
  { family: 'Righteous', category: 'display' },
  { family: 'Fredoka One', category: 'display' },
  { family: 'Lilita One', category: 'display' },
  { family: 'Boogaloo', category: 'display' },
  { family: 'Passion One', category: 'display' },
  { family: 'Anton', category: 'display' },
  { family: 'Russo One', category: 'display' },
  { family: 'Black Han Sans', category: 'display' },
  { family: 'Alfa Slab One', category: 'display' },
  { family: 'Fugaz One', category: 'display' },
  { family: 'Secular One', category: 'display' },
  { family: 'Bebas Neue', category: 'display' },
  { family: 'Permanent Marker', category: 'display' },
  { family: 'Bangers', category: 'display' },
  { family: 'Chewy', category: 'display' },
  { family: 'Bree Serif', category: 'display' },
  { family: 'Signika', category: 'display' },
  { family: 'Audiowide', category: 'display' },
  { family: 'Cinzel', category: 'display' },
  { family: 'Yeseva One', category: 'display' },
  { family: 'Syne', category: 'display' },
  { family: 'Unbounded', category: 'display' },
  { family: 'Dela Gothic One', category: 'display' },

  // Handwriting
  { family: 'Dancing Script', category: 'handwriting' },
  { family: 'Satisfy', category: 'handwriting' },
  { family: 'Courgette', category: 'handwriting' },
  { family: 'Kalam', category: 'handwriting' },
  { family: 'Cookie', category: 'handwriting' },
  { family: 'Sacramento', category: 'handwriting' },
  { family: 'Great Vibes', category: 'handwriting' },
  { family: 'Allura', category: 'handwriting' },
  { family: 'Parisienne', category: 'handwriting' },
  { family: 'Caveat', category: 'handwriting' },
  { family: 'Indie Flower', category: 'handwriting' },
  { family: 'Patrick Hand', category: 'handwriting' },
  { family: 'Amatic SC', category: 'handwriting' },
  { family: 'Shadows Into Light', category: 'handwriting' },
  { family: 'Bad Script', category: 'handwriting' },

  // Monospace
  { family: 'Roboto Mono', category: 'monospace' },
  { family: 'Source Code Pro', category: 'monospace' },
  { family: 'JetBrains Mono', category: 'monospace' },
  { family: 'Fira Code', category: 'monospace' },
  { family: 'Space Mono', category: 'monospace' },
  { family: 'IBM Plex Mono', category: 'monospace' },
  { family: 'Inconsolata', category: 'monospace' },
  { family: 'Courier Prime', category: 'monospace' },
  { family: 'Share Tech Mono', category: 'monospace' },
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
