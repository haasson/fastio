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
        <button
          v-for="level in headingLevels"
          :key="level"
          type="button"
          class="tool"
          :class="{ active: editor?.isActive('heading', { level }) }"
          @click="editor?.chain().focus().toggleHeading({ level }).run()"
        >
          H{{ level }}
        </button>
        <div class="sep" />
        <select class="font-size-select" :value="activeFontSize" @change="setFontSize">
          <option value="">Размер</option>
          <option v-for="size in fontSizes" :key="size.value" :value="size.value">{{ size.label }}</option>
        </select>
        <div class="sep" />
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
import { Extension } from '@tiptap/core'
import { THEME_PRESETS } from '@fastio/shared'

type Level = 1 | 2 | 3 | 4 | 5 | 6
import type { ThemePalette } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

const EnterAsBr = Extension.create({
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.setHardBreak(),
    }
  },
})

const props = defineProps<{
  modelValue: string
  label?: string
  headingLevels?: Level[]
}>()

const headingLevels = computed((): Level[] => props.headingLevels ?? [1, 2, 3])

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
]

const editor = useEditor({
  content: props.modelValue,
  extensions: [StarterKit, TextStyle, FontSize, Color, EnterAsBr],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

const activeColor = computed(() => editor.value?.getAttributes('textStyle').color ?? null,
)

const hasCustomColor = computed(() => !!activeColor.value)

const activeFontSize = computed(() => {
  if (!editor.value) return ''
  const attrs = editor.value.getAttributes('textStyle')

  return attrs.fontSize ?? ''
})

const setFontSize = (e: Event) => {
  // eslint-disable-next-line no-undef
  const val = (e.target as HTMLSelectElement).value

  if (!val) {
    editor.value?.chain().focus().unsetFontSize().run()
  } else {
    editor.value?.chain().focus().setFontSize(val).run()
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

.content {
  padding: var(--space-12);
  min-height: 140px;
  font-size: var(--font-size-md);
  line-height: var(--line-height-loose);
  color: var(--color-text);

  :deep(.ProseMirror) {
    outline: none;
    min-height: 120px;
    zoom: 0.55;

    h1 {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      margin: var(--space-12) 0 var(--space-4);
    }

    h2 {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-semibold);
      margin: var(--space-12) 0 var(--space-4);
    }

    h3 {
      font-size: var(--font-size-md);
      font-weight: var(--font-weight-semibold);
      margin: var(--space-8) 0 var(--space-4);
    }

    p {
      margin: 0 0 var(--space-4);

      &:last-child {
        margin-bottom: 0;
      }
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
