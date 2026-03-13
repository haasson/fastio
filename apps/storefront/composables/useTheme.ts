import { THEME_PRESETS, paletteToCssVars } from '@fastio/shared'

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

const themes: Theme[] = THEME_PRESETS.map(p => ({
  name: p.name,
  label: p.label,
  vars: paletteToCssVars(p.palette),
}))

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
