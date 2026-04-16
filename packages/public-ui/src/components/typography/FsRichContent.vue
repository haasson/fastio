<script lang="ts">
import { defineComponent, h, computed, createTextVNode } from 'vue'
import type { VNode, VNodeArrayChildren } from 'vue'
import { parse, NodeType } from 'node-html-parser'
import type { HTMLElement as NHTMLElement, Node as NNode, TextNode as NTextNode } from 'node-html-parser'
import FsHeading from './FsHeading.vue'
import FsText from './FsText.vue'

type HeadingSize = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
type RtVariant = 'body-sm' | 'caption'
type RenderOutput = VNode | string | null

const HEADING_TAGS = new Set<string>(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

const RT_VARIANT: Record<string, RtVariant> = {
  'rt-body-sm': 'body-sm',
  'rt-caption': 'caption',
}

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

function safeHref(raw: string | null): string {
  if (!raw) return '#'
  if (raw.startsWith('#') || raw.startsWith('/')) return raw
  try {
    const u = new URL(raw, 'https://placeholder.local/')
    return SAFE_PROTOCOLS.has(u.protocol) ? raw : '#'
  } catch {
    return '#'
  }
}

function isExternalHref(raw: string): boolean {
  return raw.startsWith('http') || raw.startsWith('//')
}

function renderChildren(nodes: NNode[]): VNodeArrayChildren {
  const out: VNodeArrayChildren = []
  for (const n of nodes) {
    const r = renderNode(n)
    if (r != null) out.push(r)
  }
  return out
}

function renderNode(node: NNode): RenderOutput {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const text = (node as NTextNode).text
    return text ? createTextVNode(text) : null
  }

  const el = node as NHTMLElement
  const tag = el.tagName?.toLowerCase()
  if (!tag) return null

  const kids = (): VNodeArrayChildren => renderChildren(el.childNodes)
  const slot = { default: kids }

  if (tag === 'p') {
    const classes = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
    const rtClass = classes.find((c) => c in RT_VARIANT)
    const variant = rtClass ? RT_VARIANT[rtClass] : 'body'
    return h(FsText, { as: 'p', variant }, slot)
  }

  if (HEADING_TAGS.has(tag)) {
    return h(FsHeading, { as: tag as HeadingSize }, slot)
  }

  if (tag === 'span') {
    return h('span', {}, kids())
  }

  if (tag === 'strong') return h('strong', {}, kids())
  if (tag === 'em')     return h('em', {}, kids())
  if (tag === 'br')     return h('br')

  if (tag === 'a') {
    const rawHref = el.getAttribute('href') ?? null
    const href = safeHref(rawHref)
    const props: Record<string, string> = { href }
    if (rawHref && isExternalHref(rawHref) && href !== '#') {
      props.rel = 'noopener nofollow'
    }
    return h('a', props, kids())
  }
  if (tag === 'ul' || tag === 'ol') return h(tag, {}, kids())
  if (tag === 'li') return h('li', {}, kids())

  return null
}

export default defineComponent({
  name: 'FsRichContent',
  props: {
    html: { type: String, default: '' },
  },
  setup(props) {
    const tree = computed(() => (props.html ? parse(props.html) : null))
    return () => {
      if (!tree.value) return h('div', { class: 'rich-content-root' })
      return h('div', { class: 'rich-content-root' }, renderChildren(tree.value.childNodes))
    }
  },
})
</script>
