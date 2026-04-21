<template>
  <div @click="handleLinkClick">
    <MarkdownContent v-if="article" :html="renderedContent" />
    <div v-else class="not-found">
      <UiText color="secondary">Раздел не найден</UiText>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter, useHead } from '#imports'
import { Marked } from 'marked'
import { UiText } from '@fastio/ui'
import { KB_SECTIONS } from '~/config/kb'
import { MarkdownContent } from '~/utils/markdownRenderer'

const route = useRoute()
const router = useRouter()

function handleLinkClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a')

  if (!anchor) return
  const href = anchor.getAttribute('href')

  if (href?.startsWith('/')) {
    event.preventDefault()
    router.push(href)
  }
}

const article = computed(() => {
  const section = KB_SECTIONS.find((s) => s.id === route.params.section)

  return section?.articles.find((a) => a.id === route.params.article) ?? null
})

const md = new Marked({ breaks: true, gfm: true })

type AlertType = 'info' | 'warning' | 'error' | 'success'
const ALERT_TYPES: Record<string, AlertType> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
  success: 'success',
}
// Fallback-маркеры по эмодзи в начале blockquote (для контента без явного `[!type]`)
const EMOJI_ALERTS: Array<[RegExp, AlertType]> = [
  [/^\s*(⚠️|⛔)/, 'warning'],
  [/^\s*❌/, 'error'],
  [/^\s*(✅|💡)/, 'success'],
]

function wrapSections(html: string): string {
  const parts = html.split(/(?=<h2[\s>])/)

  return parts.map((part, i) => {
    const cls = i === 0 ? 'kb-section kb-section--intro' : 'kb-section'

    return `<div class="${cls}">${part}</div>`
  }).join('')
}

function detectAlertType(inner: string): { type: AlertType; cleaned: string } {
  // Явный синтаксис: `> [!warning] ...`
  const explicit = inner.match(/\[!(\w+)\]\s*/)

  if (explicit) {
    const rawType = explicit[1].toLowerCase()
    const type = ALERT_TYPES[rawType] ?? 'info'

    return { type, cleaned: inner.replace(explicit[0], '') }
  }

  // Fallback: эмодзи-маркер в начале текста
  const stripped = inner.replace(/<\/?p>/g, '').trim()

  for (const [pattern, type] of EMOJI_ALERTS) {
    if (pattern.test(stripped)) return { type, cleaned: inner }
  }

  return { type: 'info', cleaned: inner }
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  const html = md.parse(text, { async: false }) as string
  const withAlerts = html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (_, inner: string) => {
    const { type, cleaned } = detectAlertType(inner)

    return `<kb-alert type="${type}">${cleaned}</kb-alert>`
  })

  return wrapSections(withAlerts)
}

const renderedContent = computed(() => article.value ? renderMarkdown(article.value.content) : '')

useHead(computed(() => ({
  title: article.value ? `${article.value.title} — Fastio База знаний` : 'Fastio База знаний',
})))
</script>

<style scoped lang="scss">
.not-found {
  padding: var(--space-32) 0;
  text-align: center;
}
</style>
