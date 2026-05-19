<template>
  <UiModal
    :model-value="modelValue"
    :title="gallery ? `Фото: ${gallery.name}` : 'Фото'"
    :width="1100"
    :actions="modalActions"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="photos-root">
      <div class="toolbar">
        <UiButton
          type="default"
          icon="plus"
          :loading="uploading"
          @click="fileInputRef?.click()"
        >
          Добавить фото
        </UiButton>
        <UiText size="tiny" color="var(--color-text-secondary)" class="hint">
          Одно фото — с кадрированием, несколько — загрузятся как есть
        </UiText>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          class="hidden-input"
          @change="onFileChange"
        />
      </div>

      <UiEmpty
        v-if="!uploading && photos.length === 0"
        icon="image"
        text="Нет фото. Добавьте первое."
      />

      <VueDraggable
        v-else
        v-model="photos"
        class="grid"
        handle=".drag-handle"
        :animation="180"
        ghost-class="photo-ghost"
        @end="onReorder"
      >
        <div v-for="photo in photos" :key="photo.id" class="photo-item">
          <span class="drag-handle">
            <UiIcon name="grip" :size="12" />
          </span>
          <div class="thumb">
            <img
              v-if="photo.url"
              :src="photo.url"
              alt=""
              class="thumb-img"
              loading="lazy"
            />
            <div v-else class="thumb-placeholder">
              <UiIcon name="image" :size="16" />
            </div>
          </div>
          <UiChipRemove variant="overlay" class="delete-btn" @click="handleRemove(photo.id)" />
        </div>

        <div v-if="uploading" class="photo-item photo-item--loading">
          <UiIcon name="image" :size="20" color="var(--color-text-secondary)" />
        </div>
      </VueDraggable>
    </div>
  </UiModal>

  <ImageUploadModal
    v-model="showCropModal"
    aspect-ratio="free"
    title="Добавить фото"
    :initial-file="pendingCropFile"
    @done="onCropDone"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { UiModal, UiButton, UiEmpty, UiIcon, UiText, UiChipRemove } from '@fastio/ui'
import type { ModalAction } from '@fastio/ui'
import type { Gallery, GalleryPhoto } from '@fastio/shared'
import { useConfirm } from '@fastio/kit'
import ImageUploadModal from '~/shared/ui/components/ImageUploadModal.vue'

const props = defineProps<{
  modelValue: boolean
  gallery: Gallery | null
  uploading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'upload': [files: File[]]
  'remove': [photoId: string]
  'reorder': [photos: GalleryPhoto[]]
}>()

const { confirm } = useConfirm()
const showCropModal = ref(false)
const pendingCropFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const photos = ref<GalleryPhoto[]>([])

watch(() => props.gallery?.photos, (p) => {
  photos.value = p ? [...p] : []
}, { immediate: true, deep: true })

const onFileChange = (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])

  ;(e.target as HTMLInputElement).value = ''
  if (!files.length) return

  if (files.length === 1) {
    pendingCropFile.value = files[0]
    showCropModal.value = true
  } else {
    emit('upload', files)
  }
}

const onCropDone = (file: File) => {
  emit('upload', [file])
  pendingCropFile.value = null
}

const handleRemove = async (photoId: string) => {
  const ok = await confirm({ title: 'Удалить фото?' })

  if (ok) emit('remove', photoId)
}

const onReorder = () => emit('reorder', photos.value)

const modalActions = computed((): ModalAction[] => [
  { text: 'Готово', type: 'primary', actionType: 'confirm' },
])
</script>

<style scoped lang="scss">
.photos-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.hint {
  flex: 1;
}

.hidden-input {
  display: none;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.photo-item {
  position: relative;
  height: 120px;
  flex: 0 0 auto;
  min-width: 80px;
  border-radius: var(--radius-8);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-bg-subtle);

  &--loading {
    width: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

.drag-handle {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 2;
  cursor: grab;
  color: var(--color-white);
  background: rgba(0, 0, 0, 0.4);
  border-radius: var(--radius-4);
  padding: var(--space-4);
  display: flex;
  align-items: center;
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  line-height: 1;

  &:active { cursor: grabbing; }
}

.thumb {
  height: 100%;
}

.thumb-img {
  height: 100%;
  width: auto;
  display: block;
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

// UiChipRemove overlay variant сам делает background/hover; родитель только позиционирует.
.delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
}

:deep(.photo-ghost) {
  opacity: 0.4;
}
</style>
