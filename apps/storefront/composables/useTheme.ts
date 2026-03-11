type Theme = {
  name: string
  label: string
  vars: Record<string, string>
}

// WCAG relative luminance → порог 0.179 (соотношение 4.5:1 белый/чёрный)
const hexToOnColor = (hex: string): string => {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#000000' : '#ffffff'
}

const themes: Theme[] = [
  {
    name: 'fresh',
    label: '🍊 Fresh',
    vars: {
      '--primary': '#ff6b35',
      '--color-bg': '#ffffff',
      '--color-surface': '#f5f5f5',
      '--color-text': '#111111',
      '--color-text-secondary': '#666666',
      '--color-text-muted': '#999999',
      '--color-border': '#e0e0e0',
    },
  },
  {
    name: 'dark',
    label: '🌑 Dark',
    vars: {
      '--primary': '#ff6b35',
      '--color-bg': '#2d1208',
      '--color-surface': '#3d1a0e',
      '--color-text': '#f5ede8',
      '--color-text-secondary': '#c4a090',
      '--color-text-muted': '#8a6055',
      '--color-border': '#4d2418',
    },
  },
  {
    name: 'forest',
    label: '🌲 Forest',
    vars: {
      '--primary': '#4ade80',
      '--color-bg': '#0f1f14',
      '--color-surface': '#172a1c',
      '--color-text': '#e8f5ec',
      '--color-text-secondary': '#8db89a',
      '--color-text-muted': '#5a7d65',
      '--color-border': '#243d2b',
    },
  },
  {
    name: 'sakura',
    label: '🌸 Sakura',
    vars: {
      '--primary': '#e91e8c',
      '--color-bg': '#fff5f9',
      '--color-surface': '#ffeef5',
      '--color-text': '#2d0a1a',
      '--color-text-secondary': '#7a3a57',
      '--color-text-muted': '#b07090',
      '--color-border': '#f5d0e3',
    },
  },
  {
    name: 'slate',
    label: '🪨 Slate',
    vars: {
      '--primary': '#6366f1',
      '--color-bg': '#0f172a',
      '--color-surface': '#1e293b',
      '--color-text': '#f1f5f9',
      '--color-text-secondary': '#94a3b8',
      '--color-text-muted': '#64748b',
      '--color-border': '#334155',
    },
  },
  {
    name: 'cream',
    label: '🧈 Cream',
    vars: {
      '--primary': '#c2783a',
      '--color-bg': '#fdf8f0',
      '--color-surface': '#f5ede0',
      '--color-text': '#2c1a08',
      '--color-text-secondary': '#7a5535',
      '--color-text-muted': '#b08060',
      '--color-border': '#e8d5bc',
    },
  },
  {
    name: 'neon',
    label: '⚡ Neon',
    vars: {
      '--primary': '#ff2d78',
      '--color-bg': '#08000f',
      '--color-surface': '#12001f',
      '--color-text': '#ffffff',
      '--color-text-secondary': '#cc88ff',
      '--color-text-muted': '#7744aa',
      '--color-border': '#2a0044',
    },
  },
  {
    name: 'sunset',
    label: '🌅 Sunset',
    vars: {
      '--primary': '#f97316',
      '--color-bg': '#1a0a2e',
      '--color-surface': '#2d1045',
      '--color-text': '#fde8d8',
      '--color-text-secondary': '#c4909a',
      '--color-text-muted': '#8a5060',
      '--color-border': '#4a1a50',
    },
  },
  {
    name: 'ocean',
    label: '🌊 Ocean',
    vars: {
      '--primary': '#06b6d4',
      '--color-bg': '#040d1a',
      '--color-surface': '#0a1a2e',
      '--color-text': '#e0f4ff',
      '--color-text-secondary': '#7ab8d4',
      '--color-text-muted': '#4a7a94',
      '--color-border': '#0f2a3d',
    },
  },
  {
    name: 'lemon',
    label: '🍋 Lemon',
    vars: {
      '--primary': '#eab308',
      '--color-bg': '#fffff0',
      '--color-surface': '#fefce8',
      '--color-text': '#1a1400',
      '--color-text-secondary': '#6b5800',
      '--color-text-muted': '#a07800',
      '--color-border': '#fde047',
    },
  },
]

export default (overrides?: Ref<Record<string, string>>) => {
  const currentTheme = useState<Theme>('theme', () => themes[0])
  const themeStyle = computed(() => {
    const vars = { ...currentTheme.value.vars, ...overrides?.value }
    const primary = vars['--primary']
    if (primary) vars['--on-primary'] = hexToOnColor(primary)
    return Object.entries(vars).map(([k, v]) => `${k}: ${v}`).join('; ')
  })

  const setTheme = (name: string) => {
    const found = themes.find(t => t.name === name)
    if (found) currentTheme.value = found
  }

  const randomize = () => {
    const others = themes.filter(t => t.name !== currentTheme.value.name)
    currentTheme.value = others[Math.floor(Math.random() * others.length)]
  }

  return { currentTheme, themes, themeStyle, setTheme, randomize }
}
