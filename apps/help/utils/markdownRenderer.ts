import { h, defineComponent, type VNode } from 'vue'
import { parseHTML } from 'linkedom'
import { UiAlert, UiTag, UiButton, UiTitle, UiText } from '@fastio/ui'
import type { IconName } from '@fastio/icons'
import * as LucideIcons from 'lucide-vue-next'
import { getTagColorPreset } from '@fastio/shared'

// Маппинг тегов → компоненты либы
// Добавить новый компонент: просто добавить запись в RENDERERS

type Renderer = (attrs: Record<string, string>, children: (VNode | string)[]) => VNode

type AlertType = 'default' | 'info' | 'success' | 'warning' | 'error'
type TagType = 'default' | 'primary' | 'success' | 'warning' | 'error'
type ButtonType = 'default' | 'primary' | 'tertiary' | 'error' | 'warning' | 'success' | 'info'

const ALERT_TYPES = new Set<AlertType>(['default', 'info', 'success', 'warning', 'error'])
const TAG_TYPES = new Set<TagType>(['default', 'primary', 'success', 'warning', 'error'])
const BUTTON_TYPES = new Set<ButtonType>(['default', 'primary', 'tertiary', 'error', 'warning', 'success', 'info'])

function pick<T extends string>(value: string | undefined, allowed: Set<T>, fallback: T): T {
  return value && (allowed as Set<string>).has(value) ? (value as T) : fallback
}

const RENDERERS: Record<string, Renderer> = {

  // Заголовки — UiTitle с secondary-font и --color-title
  'h1': (_attrs, children) => h(UiTitle, { size: 'h3', tag: 'h1', class: 'kb-h1' }, () => children),
  'h2': (_attrs, children) => h(UiTitle, { size: 'h4', tag: 'h2', class: 'kb-h2' }, () => children),
  'h3': (_attrs, children) => h(UiTitle, { size: 'h5', tag: 'h3', class: 'kb-h3' }, () => children),

  // Параграфы и инлайн-текст — UiText с main-font и --color-text
  'p': (_attrs, children) => h(UiText, { size: 'tiny', class: 'kb-p' }, () => children),
  'li': (_attrs, children) => h('li', {}, [h(UiText, { size: 'tiny', span: true }, () => children)]),

  'kb-alert': (attrs, children) => h(UiAlert, { type: pick<AlertType>(attrs.type, ALERT_TYPES, 'default') }, () => children),

  'kb-tag': (attrs, children) => h(UiTag, {
    type: pick<TagType>(attrs.type, TAG_TYPES, 'default'),
    size: (attrs.size as 'small' | 'medium' | 'large') ?? 'small',
    round: attrs.round !== undefined,
    icon: attrs.icon as IconName | undefined,
  }, () => children),

  'kb-button': (attrs, children) => h(UiButton, {
    type: pick<ButtonType>(attrs.type, BUTTON_TYPES, 'default'),
    size: (attrs.size as 'small' | 'medium') ?? 'small',
    ghost: attrs.ghost !== undefined,
  }, () => children),

  // Тег блюда — точно как в админке: Lucide иконка + цвета из TAG_COLOR_PRESETS
  'kb-dish-tag': (attrs, children) => {
    const preset = getTagColorPreset(attrs.color ?? 'slate')
    const icon = attrs.icon ? (LucideIcons as Record<string, unknown>)[attrs.icon] : null
    const style = preset
      ? { color: preset.color, background: preset.background, borderColor: preset.color }
      : {}

    return h('span', { class: 'kb-dish-tag', style }, [
      icon ? h(icon as Parameters<typeof h>[0], { size: 13, strokeWidth: 2.5 }) : null,
      ...children,
    ].filter(Boolean))
  },

  // Обёртка для живых UI-демонстраций в статьях
  'kb-demo': (_attrs, children) => h('div', { class: 'kb-demo' }, children),
}

const TEXT_NODE = 3
const ELEMENT_NODE = 1

function domToVNodes(node: Node): VNode | string | null {
  if (node.nodeType === TEXT_NODE) return node.textContent

  if (node.nodeType !== ELEMENT_NODE) return null

  const el = node as Element
  const tag = el.tagName.toLowerCase()

  const children = Array.from(el.childNodes)
    .map(domToVNodes)
    .filter((n): n is VNode | string => n !== null && n !== '')

  const renderer = RENDERERS[tag]

  if (renderer) {
    const attrs: Record<string, string> = {}

    for (const attr of el.attributes) attrs[attr.name] = attr.value

    return renderer(attrs, children)
  }

  const attrs: Record<string, string> = {}

  for (const attr of el.attributes) attrs[attr.name] = attr.value

  return h(tag, attrs, children.length ? children : undefined)
}

export const MarkdownContent = defineComponent({
  name: 'MarkdownContent',
  props: {
    html: { type: String, required: true },
  },
  setup(props) {
    return () => {
      const html = `<div>${props.html}</div>`
      const root = import.meta.server
        ? parseHTML(html).document.querySelector('div')!
        : new DOMParser().parseFromString(html, 'text/html').body.firstElementChild!
      const children = Array.from(root.childNodes)
        .map(domToVNodes)
        .filter((n): n is VNode | string => n !== null)

      return h('div', { class: 'kb-article' }, children)
    }
  },
})
