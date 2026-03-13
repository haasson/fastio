<template>
  <div class="upload-root" :class="{ 'upload-root--compact': compact }">
    <!-- Preview state -->
    <div v-if="previewUrl" class="preview" @click="openPicker">
      <img :src="previewUrl" class="photo" alt="" />
      <div class="overlay">
        <UiIcon
          v-if="compact"
          name="pencil"
          :size="14"
          color="white"
        />
        <UiText v-else size="small" color="white">Заменить</UiText>
      </div>
      <button
        v-if="!compact"
        type="button"
        class="remove-btn"
        @click.stop="remove"
      >
        <UiIcon name="close" :size="14" color="white" />
      </button>
    </div>

    <!-- Empty state: drop zone -->
    <div
      v-else
      class="zone"
      :class="{ dragging }"
      @click="openPicker"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <UiIcon name="plus" :size="compact ? 20 : 32" color="var(--color-text-tertiary)" />
      <UiText v-if="!compact" size="small" color="var(--color-text-secondary)">
        Перетащите или нажмите для загрузки
      </UiText>
    </div>

    <!-- URL input — only in default mode -->
    <template v-if="!compact && !previewUrl">
      <div class="url-row">
        <UiInput
          v-model="urlInput"
          placeholder="или вставьте ссылку на изображение"
          :clearable="false"
          @keydown.enter="loadFromUrl"
        />
        <UiButton
          size="small"
          type="primary"
          :disabled="!urlInput.trim()"
          :loading="urlLoading"
          @click="loadFromUrl"
        >
          Загрузить
        </UiButton>
      </div>
      <UiText v-if="urlError" size="tiny" color="var(--color-error)">
        {{ urlError }}
      </UiText>
    </template>

    <input
      ref="inputRef"
      type="file"
      accept="image/*"
      :multiple="multiple"
      class="hidden-input"
      @change="onFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { UiIcon, UiText, UiInput, UiButton } from '@fastio/ui'
import { useRuntimeConfig } from '#imports'

const props = defineProps<{
  modelValue: string | null
  compact?: boolean
  multiple?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'pending': [file: File | null]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const pendingUrl = ref<string | null>(null)
const dragging = ref(false)
const urlInput = ref('')
const urlLoading = ref(false)
const urlError = ref('')

const previewUrl = computed(() => pendingUrl.value ?? props.modelValue)

const openPicker = () => inputRef.value?.click()

const setFile = (file: File) => {
  if (pendingUrl.value) URL.revokeObjectURL(pendingUrl.value)
  pendingUrl.value = URL.createObjectURL(file)
  emit('pending', file)
}

const processFiles = (files: File[]) => {
  const toProcess = props.multiple ? files : files.slice(0, 1)

  toProcess.forEach(setFile)
}

const onFileChange = (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])

  processFiles(files)
  ;(e.target as HTMLInputElement).value = ''
}

const onDrop = (e: DragEvent) => {
  dragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))

  processFiles(files)
}

const loadFromUrl = async () => {
  const url = urlInput.value.trim()

  if (!url) return

  urlError.value = ''
  urlLoading.value = true

  try {
    const { supabaseUrl, supabaseAnonKey } = useRuntimeConfig().public
    const proxyUrl = `${supabaseUrl}/functions/v1/proxy-image?url=${encodeURIComponent(url)}`
    const response = await fetch(proxyUrl, {
      headers: { Authorization: `Bearer ${supabaseAnonKey}` },
    })

    if (!response.ok) {
      const status = response.status

      throw new Error(status === 422 ? 'Ссылка не ведёт на изображение' : 'Не удалось загрузить')
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const blob = await response.blob()
    const ext = contentType.split('/')[1]?.split(';')[0] ?? 'jpg'
    const file = new File([blob], `url-image.${ext}`, { type: contentType })

    setFile(file)
    urlInput.value = ''
  } catch (e) {
    urlError.value = e instanceof Error ? e.message : 'Не удалось загрузить изображение'
  } finally {
    urlLoading.value = false
  }
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
  display: flex;
  flex-direction: column;
  gap: 8px;

  &--compact {
    width: 100%;
    height: 100%;
  }
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

  .upload-root--compact & {
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    border-radius: 0;
  }

  &:hover,
  &.dragging {
    border-color: var(--color-primary);
    background: var(--color-bg-hover, rgba(0, 0, 0, 0.02));
  }
}

.url-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
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

  .upload-root--compact & {
    aspect-ratio: unset;
    height: 100%;
    border-radius: 0;
  }
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
