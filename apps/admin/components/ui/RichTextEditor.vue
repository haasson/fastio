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
        <label class="color-tool" title="Цвет текста">
          <input
            type="color"
            class="color-input"
            :value="activeColor"
            @input="setColor"
          />
          <span class="color-preview" :style="{ background: activeColor }" />
          <span class="color-label">A</span>
        </label>
        <template v-if="colors?.length">
          <button
            v-for="color in colors"
            :key="color"
            type="button"
            class="color-swatch"
            :class="{ 'is-active': activeColor === color }"
            :style="{ background: color }"
            :title="color"
            @click="editor?.chain().focus().setColor(color).run()"
          />
        </template>
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
      <EditorContent class="content" :editor="editor" />
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
  colors?: string[]
  headingLevels?: number[]
}>()

const headingLevels = computed(() => props.headingLevels ?? [1, 2, 3])

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

const activeColor = computed(() => {
  if (!editor.value) return '#000000'

  return editor.value.getAttributes('textStyle').color ?? '#000000'
})

const hasCustomColor = computed(() => {
  if (!editor.value) return false

  return !!editor.value.getAttributes('textStyle').color
})

const setColor = (e: Event) => {
  const val = (e.target as HTMLInputElement).value

  editor.value?.chain().focus().setColor(val).run()
}

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
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.editor-wrap {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--color-primary);
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
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
  padding: 0 6px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--color-bg-hover);
    color: var(--color-text);
  }

  &.active {
    background: var(--color-primary-light, rgba(var(--color-primary-rgb, 99 102 241) / 0.12));
    color: var(--color-primary);
  }
}

.font-size-select {
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: var(--color-bg);
  color: var(--color-text-secondary);
  font-size: 12px;
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
  margin: 0 4px;
}

.color-tool {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  position: relative;
  cursor: pointer;
  padding: 0 4px;
  height: 28px;
  border-radius: 5px;
  transition: background 0.15s;

  &:hover { background: var(--color-bg-hover); }
}

.color-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.color-preview {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.color-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1;
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
  padding: 12px 14px;
  min-height: 140px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);

  :deep(.ProseMirror) {
    outline: none;
    min-height: 120px;
    zoom: 0.55;

    h1 {
      font-size: 22px;
      font-weight: 700;
      margin: 14px 0 6px;
    }

    h2 {
      font-size: 17px;
      font-weight: 600;
      margin: 12px 0 6px;
    }

    h3 {
      font-size: 15px;
      font-weight: 600;
      margin: 10px 0 4px;
    }

    p {
      margin: 0 0 6px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    ul {
      padding-left: 20px;
      margin: 4px 0 8px;
      list-style: disc;
    }

    ol {
      padding-left: 20px;
      margin: 4px 0 8px;
      list-style: decimal;
    }

    li {
      margin-bottom: 2px;
      display: list-item;
    }

    p.is-editor-empty:first-child::before {
      content: attr(data-placeholder);
      color: var(--color-text-placeholder, var(--color-text-secondary));
      pointer-events: none;
      float: left;
      height: 0;
    }
  }
}
</style>
