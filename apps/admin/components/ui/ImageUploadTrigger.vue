<template>
  <div class="trigger-root" :class="{ 'trigger-root--compact': compact }" :style="rootStyle">
    <!-- Preview state -->
    <div
      v-if="previewUrl"
      class="preview"
      :style="previewStyle"
      @click="showModal = true"
    >
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

    <!-- Empty state -->
    <div
      v-else
      class="zone"
      :style="previewStyle"
      @click="showModal = true"
    >
      <UiIcon name="plus" :size="compact ? 24 : 32" color="var(--color-text-tertiary)" />
      <span v-if="compact" class="compact-label">Фото</span>
      <UiText v-else size="small" color="var(--color-text-secondary)">Добавить фото</UiText>
    </div>

    <ImageUploadModal
      v-model="showModal"
      :aspect-ratio="aspectRatio"
      :title="modalTitle"
      @done="onDone"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { UiIcon, UiText } from '@fastio/ui'
import ImageUploadModal from '~/components/ui/ImageUploadModal.vue'
import type { ImageAspectRatio } from '~/components/ui/ImageUploadModal.vue'

const props = withDefaults(defineProps<{
  modelValue: string | null
  aspectRatio?: ImageAspectRatio
  compact?: boolean
  width?: string
  height?: string
  modalTitle?: string
}>(), {
  aspectRatio: '4:3',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'pending': [file: File | null]
}>()

const showModal = ref(false)
const pendingBlobUrl = ref<string | null>(null)

const previewUrl = computed(() => pendingBlobUrl.value ?? props.modelValue)

const rootStyle = computed(() => {
  if (!props.compact) return {}

  return {
    ...(props.width && { width: props.width }),
    ...(props.height && { height: props.height }),
  }
})

const previewStyle = computed(() => {
  if (props.compact) return {}
  if (props.aspectRatio === 'free') return {}
  const [w, h] = props.aspectRatio.split(':').map(Number)

  return { aspectRatio: `${w} / ${h}` }
})

const onDone = (file: File) => {
  if (pendingBlobUrl.value) URL.revokeObjectURL(pendingBlobUrl.value)
  pendingBlobUrl.value = URL.createObjectURL(file)
  emit('pending', file)
}

const remove = () => {
  if (pendingBlobUrl.value) {
    URL.revokeObjectURL(pendingBlobUrl.value)
    pendingBlobUrl.value = null
  }
  emit('pending', null)
  emit('update:modelValue', null)
}

onUnmounted(() => {
  if (pendingBlobUrl.value) URL.revokeObjectURL(pendingBlobUrl.value)
})
</script>

<style scoped lang="scss">
.trigger-root {
  width: 100%;

  &--compact {
    width: 100%;
    height: 100%;
  }
}

.zone {
  border: 1.5px dashed var(--color-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  padding: 28px 16px;

  .trigger-root--compact & {
    width: 100%;
    height: 100%;
    padding: 0;
  }

  &:hover {
    border-color: var(--color-primary);
    background: var(--color-bg-hover);
  }
}

.preview {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;

  .trigger-root--compact & {
    aspect-ratio: unset;
    height: 100%;
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

.compact-label {
  font-size: 10px;
  color: var(--color-text-tertiary);
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
