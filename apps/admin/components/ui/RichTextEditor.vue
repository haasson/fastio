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
          type="button"
          class="tool"
          :class="{ active: editor?.isActive('heading', { level: 2 }) }"
          @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          H2
        </button>
        <button
          type="button"
          class="tool"
          :class="{ active: editor?.isActive('heading', { level: 3 }) }"
          @click="editor?.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          H3
        </button>
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
import { watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'

const props = defineProps<{
  modelValue: string
  label?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const editor = useEditor({
  content: props.modelValue,
  extensions: [StarterKit],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

watch(() => props.modelValue, (val) => {
  if (editor.value && editor.value.getHTML() !== val) {
    editor.value.commands.setContent(val)
  }
})

onBeforeUnmount(() => editor.value?.destroy())
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/media-queries' as *;

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

.sep {
  width: 1px;
  height: 18px;
  background: var(--color-border);
  margin: 0 4px;
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
