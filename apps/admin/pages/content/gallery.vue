<template>
  <div class="tab-root">
    <div class="toolbar">
      <UiButton
        type="primary"
        icon="plus"
        @click="openAdd"
      >
        Добавить галерею
      </UiButton>
    </div>

    <UiSkeleton v-if="loading" :height="72" :count="3" />

    <UiEmpty
      v-else-if="galleries.length === 0"
      icon="image"
      text="Галерей пока нет. Создайте первую — потом выберете её в настройках разделов."
    />

    <AppDraggableList
      v-else
      v-model="galleries"
      @reorder="onReorder"
    >
      <AppListRow
        v-for="gallery in galleries"
        :key="gallery.id"
        :name="gallery.name"
        :thumb-url="gallery.photos[0]?.url ?? null"
        thumb-width="72px"
        thumb-height="48px"
      >
        <div class="gallery-info">
          <UiText size="tiny" color="var(--color-text-secondary)">
            {{ gallery.photos.length }} фото
          </UiText>
          <div class="usage-tags">
            <template v-if="usedIn(gallery.id).length">
              <UiTag
                v-for="label in usedIn(gallery.id)"
                :key="label"
                type="primary"
                empty
                size="tiny"
              >{{ label }}</UiTag>
            </template>
            <UiTag v-else type="default" size="tiny">Не используется</UiTag>
          </div>
        </div>

        <template #append>
          <AppActionsBlock
            size="small"
            @edit="openEdit(gallery)"
            @delete="handleRemove(gallery)"
          >
            <template #prepend>
              <button type="button" class="photos-btn" @click="openPhotos(gallery)">
                <UiIcon name="image" :size="14" />
                Фото
              </button>
            </template>
          </AppActionsBlock>
        </template>
      </AppListRow>
    </AppDraggableList>

    <GalleryFormModal
      v-model="showFormModal"
      :gallery="editing"
      :saving="saving"
      @save="handleSave"
    />

    <GalleryPhotosModal
      v-model="showPhotosModal"
      :gallery="photosGallery"
      :uploading="uploading"
      @upload="handleUpload"
      @remove="handleRemovePhoto"
      @reorder="handleReorderPhotos"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiEmpty, UiIcon, UiSkeleton, UiTag, UiText } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Gallery, GalleryFormData } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useGalleries } from '~/composables/data/useGalleries'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import GalleryFormModal from '~/components/gallery/GalleryFormModal.vue'
import GalleryPhotosModal from '~/components/gallery/GalleryPhotosModal.vue'

const tenantStore = useTenantStore()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const { galleries, loading, add, update, remove, reorder, uploadPhoto, removePhoto, reorderPhotos } = useGalleries(tenantId)

const showFormModal = ref(false)
const showPhotosModal = ref(false)
const editing = ref<Gallery | null>(null)
const photosGallery = ref<Gallery | null>(null)
const saving = ref(false)
const uploading = ref(false)

const { confirm } = useConfirm()

const siteLayout = computed(() => tenantStore.tenant?.siteLayout)

const usedIn = (galleryId: string): string[] => {
  const result: string[] = []
  const layout = siteLayout.value

  if (!layout) return result
  if (layout.sections.gallery.galleryIds?.includes(galleryId)) result.push('Главная')
  if (layout.pageSettings.gallery?.galleryIds?.includes(galleryId)) result.push('Страница')

  return result
}

const onReorder = () => reorder(galleries.value)

const openAdd = () => {
  editing.value = null
  showFormModal.value = true
}

const openEdit = (gallery: Gallery) => {
  editing.value = gallery
  showFormModal.value = true
}

const openPhotos = (gallery: Gallery) => {
  photosGallery.value = gallery
  showPhotosModal.value = true
}

const handleSave = async (data: GalleryFormData) => {
  saving.value = true
  try {
    if (editing.value) {
      await update(editing.value.id, data)
    } else {
      await add(data)
    }
    showFormModal.value = false
  } finally {
    saving.value = false
  }
}

const handleRemove = async (gallery: Gallery) => {
  const ok = await confirm({ title: 'Удалить галерею?', message: 'Все фото будут удалены.' })

  if (ok) await remove(gallery.id)
}

const handleUpload = async (files: File[]) => {
  if (!photosGallery.value) return
  uploading.value = true
  try {
    for (const file of files) {
      await uploadPhoto(photosGallery.value!.id, file)
      photosGallery.value = galleries.value.find((g) => g.id === photosGallery.value?.id) ?? null
    }
  } finally {
    uploading.value = false
  }
}

const handleRemovePhoto = async (photoId: string) => {
  if (!photosGallery.value) return
  await removePhoto(photosGallery.value.id, photoId)
  photosGallery.value = galleries.value.find((g) => g.id === photosGallery.value?.id) ?? null
}

const handleReorderPhotos = async (photos: Gallery['photos']) => {
  if (!photosGallery.value) return
  await reorderPhotos(photosGallery.value.id, photos)
}
</script>

<style scoped lang="scss">
.tab-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

.gallery-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.usage-tags {
  display: flex;
  gap: 4px;
}

.photos-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: var(--color-text);
    background: var(--color-bg-hover);
  }
}
</style>
