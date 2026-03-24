<template>
  <div class="image-list-root">
    <div class="grid">
      <div
        v-for="(item, i) in items"
        :key="item._key"
        class="card"
        :class="{
          'card--disabled': !item.enabled,
          'card--over': dragOverIndex === i,
          'card--dragging': dragIndex === i,
        }"
        draggable="true"
        @dragstart="dragIndex = i"
        @dragover.prevent="dragOverIndex = i"
        @dragleave="dragOverIndex = null"
        @drop.prevent="onReorderDrop(i)"
        @dragend="dragIndex = null; dragOverIndex = null"
      >
        <img
          v-if="item.url"
          :src="item.url"
          class="card-photo"
          alt=""
          @click="openReplaceModal(i)"
        />
        <div v-else class="card-empty" @click="openReplaceModal(i)">
          <UiIcon name="image" :size="16" color="var(--color-text-tertiary)" />
        </div>
        <div v-if="!item.enabled" class="dim" />
        <div class="actions">
          <button
            type="button"
            class="action-btn"
            :title="item.enabled ? 'Отключить' : 'Включить'"
            @click.stop="toggleEnabled(i)"
          >
            <UiIcon :name="item.enabled ? 'eye' : 'eyeClose'" :size="12" />
          </button>
          <button
            type="button"
            class="action-btn action-btn--danger"
            title="Удалить"
            @click.stop="remove(i)"
          >
            <UiIcon name="trash" :size="12" />
          </button>
        </div>
      </div>

      <div class="card card--add" @click="openAddModal">
        <UiIcon name="plus" :size="20" color="var(--color-text-tertiary)" />
      </div>
    </div>

    <ImageUploadModal
      v-model="modalOpen"
      aspect-ratio="3:1"
      title="Баннер"
      @done="onModalDone"
    />
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, ref } from 'vue'
import { UiIcon } from '@fastio/ui'
import ImageUploadModal from '~/components/ui/ImageUploadModal.vue'
import type { BannerItem } from '@fastio/shared'

type InternalItem = BannerItem & { _key: string }

const props = defineProps<{ modelValue: BannerItem[] }>()
const emit = defineEmits<{
  'update:modelValue': [value: BannerItem[]]
  'pending': [files: { blobUrl: string; file: File }[]]
}>()

// --- state ---
let keyCounter = 0
const pendingFiles = new Map<string, File>()
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

const makeItems = (src: BannerItem[]): InternalItem[] => src.map((item) => ({ ...item, _key: `${item.url}-${keyCounter++}` }))

const items = reactive<InternalItem[]>(makeItems(props.modelValue))

// --- sync ---
const emitChanges = () => {
  emit('update:modelValue', items.map(({ url, enabled }) => ({ url, enabled })))
  emit('pending', [...pendingFiles.entries()].map(([blobUrl, file]) => ({ blobUrl, file })))
}

watch(
  () => props.modelValue,
  (v) => {
    const currentJson = JSON.stringify(items.map(({ url, enabled }) => ({ url, enabled })))

    if (currentJson !== JSON.stringify(v)) {
      items.splice(0, items.length, ...makeItems(v))
    }
  },
  { deep: true },
)

watch(items, emitChanges, { deep: true })

// --- blob helpers ---
const revokeBlob = (url: string) => {
  if (!url.startsWith('blob:')) return
  URL.revokeObjectURL(url)
  pendingFiles.delete(url)
}

const createBlob = (file: File): string => {
  const blobUrl = URL.createObjectURL(file)

  pendingFiles.set(blobUrl, file)

  return blobUrl
}

// --- actions ---
const toggleEnabled = (i: number) => {
  items[i].enabled = !items[i].enabled
}

const remove = (i: number) => {
  revokeBlob(items[i].url)
  items.splice(i, 1)
}

// --- modal ---
const modalOpen = ref(false)
const modalTargetIndex = ref<number | null>(null)

const openReplaceModal = (i: number) => {
  modalTargetIndex.value = i
  modalOpen.value = true
}

const openAddModal = () => {
  modalTargetIndex.value = null
  modalOpen.value = true
}

const onModalDone = (file: File) => {
  const blobUrl = createBlob(file)

  if (modalTargetIndex.value !== null) {
    revokeBlob(items[modalTargetIndex.value].url)
    items[modalTargetIndex.value].url = blobUrl
  } else {
    items.push({ _key: `${blobUrl}-${keyCounter++}`, url: blobUrl, enabled: true })
  }
}

const onReorderDrop = (targetIndex: number) => {
  if (dragIndex.value === null || dragIndex.value === targetIndex) return
  const [moved] = items.splice(dragIndex.value, 1)

  items.splice(targetIndex, 0, moved)
  dragIndex.value = null
  dragOverIndex.value = null
}
</script>

<style scoped lang="scss">
.image-list-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}

.card {
  position: relative;
  height: 66px;
  border-radius: 6px;
  overflow: hidden;
  border: 1.5px solid var(--color-border);
  cursor: grab;
  flex-shrink: 0;
  transition: border-color 0.15s, opacity 0.15s;

  &:active { cursor: grabbing; }
  &--disabled { opacity: 0.45; }
  &--dragging { opacity: 0.35; }
  &--over { border-color: var(--color-primary); }

  &--add {
    border-style: dashed;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover { border-color: var(--color-primary); background: var(--color-bg-hover); }
  }

  &:hover .actions { opacity: 1; }
}

.card-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  cursor: pointer;
}

.card-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.dim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.actions {
  position: absolute;
  bottom: 4px;
  right: 4px;
  display: flex;
  gap: 3px;
  opacity: 0;
  transition: opacity 0.15s;
}

.action-btn {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;

  &:hover { background: rgba(0, 0, 0, 0.85); }
  &--danger:hover { background: rgba(220, 38, 38, 0.85); }
}
</style>
