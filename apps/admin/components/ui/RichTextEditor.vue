<template>
  <div class="editor-root">
    <label v-if="label" class="label">{{ label }}</label>
    <div class="editor-wrap">
      <div class="toolbar">
        <button
          type="button"
          class="tool"
          :class="{ active: editor?.isActive('bold') }"
          @click="editor?.chain().focus().toggleBold().run()"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          class="tool"
          :class="{ active: editor?.isActive('italic') }"
          @click="editor?.chain().focus().toggleItalic().run()"
        >
          <em>I</em>
        </button>
        <div class="sep" />

        <!-- Нехиро: семантический дропдаун стилей -->
        <select
          v-if="!hero"
          class="style-select"
          :value="activeBlockStyle"
          @change="setBlockStyle"
        >
          <option value="paragraph">Текст</option>
          <option value="body-sm">Мелкий</option>
          <option value="caption">Подпись</option>
          <option value="h2">Заголовок 1</option>
          <option value="h3">Заголовок 2</option>
          <option value="h4">Заголовок 3</option>
        </select>

        <!-- Хиро: кнопка H1 + дропдаун размеров -->
        <template v-if="hero">
          <button
            type="button"
            class="tool"
            :class="{ active: editor?.isActive('heading', { level: 1 }) }"
            @click="editor?.chain().focus().toggleHeading({ level: 1 }).run()"
          >
            H1
          </button>
          <div class="sep" />
          <select class="font-size-select" :value="activeFontSize" @change="setFontSize">
            <option value="">Размер</option>
            <option v-for="size in fontSizes" :key="size.value" :value="size.value">{{ size.label }}</option>
          </select>
        </template>

        <div class="sep" />

        <!-- Цвета из палитры (везде) -->
        <button
          v-for="color in themeColors"
          :key="color.stored"
          type="button"
          class="color-swatch"
          :class="{ 'is-active': activeColor === color.stored }"
          :style="{ background: color.display }"
          :title="color.label"
          @click="editor?.chain().focus().setColor(color.stored).run()"
        />

        <!-- Произвольный колорпикер (только хиро) -->
        <label v-if="hero" class="color-picker-wrap" title="Произвольный цвет">
          <input
            type="color"
            class="color-picker-input"
            :value="activeColorHex"
            @input="setPickerColor"
          />
          <span class="color-picker-icon">&#x1F308;</span>
        </label>

        <button
          v-if="hasCustomColor"
          type="button"
          class="tool"
          title="Сбросить цвет"
          @click="editor?.chain().focus().unsetColor().run()"
        >✕</button>

        <div class="sep" />
        <button
          type="button"
          class="tool"
          :class="{ active: editor?.isActive('bulletList') }"
          @click="editor?.chain().focus().toggleBulletList().run()"
        >
          ≡
        </button>
        <button
          type="button"
          class="tool"
          :class="{ active: editor?.isActive('orderedList') }"
          @click="editor?.chain().focus().toggleOrderedList().run()"
        >
          1.
        </button>
      </div>
      <EditorContent class="content" :style="contentStyle" :editor="editor" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, FontSize } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { THEME_PRESETS } from '@fastio/shared'
import type { ThemePalette } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

// Типизированный параграф с attribute `variant` — рендерится как <p> или <p class="rt-body-sm"|"rt-caption">
const TypedParagraph = Node.create({
  name: 'paragraph',
  priority: 1000,
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return {
      variant: {
        default: null,
        parseHTML: (el) => {
          const cls = [...(el as HTMLElement).classList].find(
            (c) => c === 'rt-body-sm' || c === 'rt-caption',
          )

          if (cls === 'rt-body-sm') return 'body-sm'
          if (cls === 'rt-caption') return 'caption'

          return null
        },
        renderHTML: (attrs) => (attrs.variant ? { class: `rt-${attrs.variant}` } : {}),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'p' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setParagraph:
        () => ({ commands }) => commands.setNode(this.name),
    }
  },
  addKeyboardShortcuts() {
    return {
      'Mod-Alt-0': () => this.editor.commands.setParagraph(),
    }
  },
})

// Hero-режим: Enter создаёт <br>, а не новый <p>
const EnterAsBr = Extension.create({
  name: 'enterAsBr',
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.setHardBreak(),
    }
  },
})

const props = defineProps<{
  modelValue: string
  label?: string
  hero?: boolean
}>()

const tenantStore = useTenantStore()

const activePalette = computed((): ThemePalette | null => {
  const theme = tenantStore.tenant?.theme

  if (!theme) return null
  if (theme.activeCustomId) {
    const custom = theme.customThemes.find((c) => c.id === theme.activeCustomId)

    if (custom) return custom.palette
  }
  if (theme.palette) return theme.palette

  return THEME_PRESETS.find((p) => p.name === theme.preset)?.palette ?? null
})

const themeColors = computed(() => {
  const p = activePalette.value

  return [
    { label: 'Основной', stored: 'var(--color-text)', display: p?.text ?? '#111' },
    { label: 'Акцент', stored: 'var(--primary)', display: p?.primary ?? '#888' },
    { label: 'Вторичный', stored: 'var(--color-text-secondary)', display: p?.textSecondary ?? '#888' },
    { label: 'Приглушённый', stored: 'var(--color-text-muted)', display: p?.textMuted ?? '#aaa' },
  ]
})

const contentStyle = computed(() => {
  const p = activePalette.value

  if (!p) return {}

  return {
    '--primary': p.primary,
    '--color-text': p.text,
    '--color-text-secondary': p.textSecondary,
    '--color-text-muted': p.textMuted,
    'background': p.bg,
  }
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const fontSizes = [
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '20px', value: '20px' },
  { label: '24px', value: '24px' },
  { label: '32px', value: '32px' },
  { label: '40px', value: '40px' },
  { label: '48px', value: '48px' },
  { label: '56px', value: '56px' },
  { label: '64px', value: '64px' },
  { label: '72px', value: '72px' },
  { label: '80px', value: '80px' },
  { label: '96px', value: '96px' },
  { label: '120px', value: '120px' },
  { label: '144px', value: '144px' },
]

const baseExtensions = [
  StarterKit.configure({ paragraph: false }),
  TypedParagraph,
  TextStyle,
  FontSize,
  Color,
]
const extensions = props.hero ? [...baseExtensions, EnterAsBr] : baseExtensions

const editor = useEditor({
  content: props.modelValue,
  extensions,
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

// ─── Цвет ────────────────────────────────────────────────────────────────────

const activeColor = computed(() => editor.value?.getAttributes('textStyle').color ?? null)

const hasCustomColor = computed(() => !!activeColor.value)

const activeColorHex = computed(() => {
  const c = activeColor.value

  if (!c) return '#000000'
  if (c.startsWith('var(')) {
    if (typeof window === 'undefined') return '#000000'
    const match = c.match(/var\((--[^)]+)\)/)

    if (!match) return '#000000'
    const resolved = getComputedStyle(document.body).getPropertyValue(match[1]).trim()

    return resolved || '#000000'
  }

  return c
})

const setPickerColor = (e: Event) => {
  const val = (e.target as HTMLInputElement).value

  editor.value?.chain().focus().setColor(val).run()
}

// ─── Размер шрифта (только хиро) ─────────────────────────────────────────────

const activeFontSize = computed(() => {
  if (!editor.value) return ''

  return editor.value.getAttributes('textStyle').fontSize ?? ''
})

const setFontSize = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value

  if (!val) {
    editor.value?.chain().focus().unsetFontSize().run()
  } else {
    editor.value?.chain().focus().setFontSize(val).run()
  }
}

// ─── Блочный стиль (только нехиро) ───────────────────────────────────────────

const activeBlockStyle = computed(() => {
  if (!editor.value) return 'paragraph'
  if (editor.value.isActive('heading', { level: 2 })) return 'h2'
  if (editor.value.isActive('heading', { level: 3 })) return 'h3'
  if (editor.value.isActive('heading', { level: 4 })) return 'h4'
  const variant = editor.value.getAttributes('paragraph').variant

  if (variant === 'body-sm') return 'body-sm'
  if (variant === 'caption') return 'caption'

  return 'paragraph'
})

const setBlockStyle = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value

  if (!editor.value) return

  const chain = editor.value.chain().focus()

  switch (val) {
    case 'h2':
      chain.updateAttributes('paragraph', { variant: null }).setHeading({ level: 2 }).run()
      break
    case 'h3':
      chain.updateAttributes('paragraph', { variant: null }).setHeading({ level: 3 }).run()
      break
    case 'h4':
      chain.updateAttributes('paragraph', { variant: null }).setHeading({ level: 4 }).run()
      break
    case 'body-sm':
      chain.setParagraph().updateAttributes('paragraph', { variant: 'body-sm' }).run()
      break
    case 'caption':
      chain.setParagraph().updateAttributes('paragraph', { variant: 'caption' }).run()
      break
    default:
      chain.setParagraph().updateAttributes('paragraph', { variant: null }).run()
  }
}

watch(() => props.modelValue, (val) => {
  if (editor.value && editor.value.getHTML() !== val) {
    editor.value.commands.setContent(val)
  }
})

onBeforeUnmount(() => editor.value?.destroy())
</script>

<style scoped lang="scss">
.editor-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.editor-wrap {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  overflow: hidden;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--color-primary);
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-8);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  flex-wrap: wrap;
}

.tool {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 var(--space-4);
  border: none;
  border-radius: var(--radius-4);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--color-bg-hover);
    color: var(--color-text);
  }

  &.active {
    background: var(--color-primary-light);
    color: var(--color-primary);
  }
}

.style-select,
.font-size-select {
  height: 28px;
  padding: 0 var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-4);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  outline: none;

  &:focus {
    border-color: var(--color-primary);
    color: var(--color-text);
  }
}

.sep {
  width: 1px;
  height: 18px;
  background: var(--color-border);
  margin: 0 var(--space-4);
}

.color-swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.1s, border-color 0.1s;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);

  &:hover { transform: scale(1.2); }

  &.is-active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }
}

.color-picker-wrap {
  position: relative;
  width: 22px;
  height: 22px;
  cursor: pointer;
  flex-shrink: 0;

  &:hover .color-picker-icon {
    transform: scale(1.2);
  }
}

.color-picker-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  padding: 0;
  border: none;
}

.color-picker-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 14px;
  line-height: 1;
  pointer-events: none;
  transition: transform 0.1s;
  user-select: none;
}

.content {
  padding: var(--space-12);
  min-height: 140px;
  line-height: var(--line-height-loose);
  color: var(--color-text);

  :deep(.ProseMirror) {
    outline: none;
    min-height: 120px;

    p {
      margin: 0 0 var(--space-8);
      font-size: 18px;
      line-height: 1.7;

      &:last-child { margin-bottom: 0; }
    }

    p.rt-body-sm {
      font-size: 16px;
      line-height: 1.6;
    }

    p.rt-caption {
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-text-muted);
    }

    h2 {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.25;
      font-family: var(--heading-font-family, var(--font-family, inherit));
      margin: 0 0 var(--space-8);
    }

    h3 {
      font-size: 22px;
      font-weight: 600;
      line-height: 1.3;
      font-family: var(--heading-font-family, var(--font-family, inherit));
      margin: 0 0 var(--space-8);
    }

    h4 {
      font-size: 18px;
      font-weight: 600;
      line-height: 1.35;
      font-family: var(--heading-font-family, var(--font-family, inherit));
      margin: 0 0 var(--space-8);
    }

    ul {
      padding-left: var(--space-20);
      margin: var(--space-4) 0 var(--space-8);
      list-style: disc;
    }

    ol {
      padding-left: var(--space-20);
      margin: var(--space-4) 0 var(--space-8);
      list-style: decimal;
    }

    li {
      margin-bottom: var(--space-4);
      display: list-item;
    }

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      color: var(--color-text-secondary);
      pointer-events: none;
      float: left;
      height: 0;
    }
  }
}
</style>

