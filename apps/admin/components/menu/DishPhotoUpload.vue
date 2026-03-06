<template>
  <div class="upload-root">
    <!-- Empty state -->
    <!--  TODO: в проекте много где загружаются фото, и везде отдельная реализация. Нужен какой-то компонент аплоадер  -->
    <div
      v-if="!previewUrl"
      class="zone"
      @click="openPicker"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <UiIcon name="image" :size="32" color="var(--color-text-tertiary)" />
      <UiText size="small" color="var(--color-text-secondary)">Загрузить фото</UiText>
    </div>

    <!-- Preview state -->
    <div v-else class="preview" @click="openPicker">
      <img :src="previewUrl" class="photo" alt="" />
      <div class="overlay">
        <UiText size="small" color="white">Заменить</UiText>
      </div>
      <button type="button" class="remove-btn" @click.stop="remove">
        <UiIcon name="close" :size="14" color="white" />
      </button>
    </div>

    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      class="hidden-input"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
/* global HTMLInputElement, DragEvent */
import { ref, computed, onUnmounted } from 'vue'
import { UiIcon, UiText } from '@fastio/ui'

const props = defineProps<{
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'pending': [file: File | null]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const pendingUrl = ref<string | null>(null)

const previewUrl = computed(() => pendingUrl.value ?? props.modelValue)

const openPicker = () => inputRef.value?.click()

const setFile = (file: File) => {
  if (pendingUrl.value) URL.revokeObjectURL(pendingUrl.value)
  pendingUrl.value = URL.createObjectURL(file)
  emit('pending', file)
}

const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]

  if (!file) return
  setFile(file)
  // reset input so same file can be re-selected
  ;(e.target as HTMLInputElement).value = ''
}

const onDrop = (e: DragEvent) => {
  const file = e.dataTransfer?.files?.[0]

  if (!file || !file.type.startsWith('image/')) return
  setFile(file)
}

const remove = () => {
  if (pendingUrl.value) {
    URL.revokeObjectURL(pendingUrl.value)
    pendingUrl.value = null
  }
  emit('pending', null)
  emit('update:modelValue', null)
}

onUnmounted(() => {
  if (pendingUrl.value) URL.revokeObjectURL(pendingUrl.value)
})
</script>

<style scoped lang="scss">
.upload-root {
  width: 100%;
}

.zone {
  border: 1.5px dashed var(--color-border);
  border-radius: 8px;
  padding: 28px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-hover, rgba(0, 0, 0, 0.02));
  }
}

.hidden-input {
  display: none;
}

.preview {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
}

.photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;

  .preview:hover & {
    opacity: 1;
  }
}

.remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.8);
  }
}
</style>
