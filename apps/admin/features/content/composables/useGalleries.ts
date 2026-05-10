import { ref, type Ref } from 'vue'
import type { Gallery, GalleryFormData, GalleryPhoto } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

export function useGalleries(tenantId: Ref<string>) {
  const api = useDatabase()

  const galleries = ref<Gallery[]>([])
  const loading = ref(false)

  const fetch = async () => {
    if (!tenantId.value) return
    loading.value = true
    try {
      galleries.value = await api.galleries.list(tenantId.value)
    } finally {
      loading.value = false
    }
  }

  const add = async (data: GalleryFormData): Promise<Gallery | null> => {
    if (!tenantId.value) return null
    const item = await api.galleries.add(tenantId.value, data, galleries.value.length)

    if (item) galleries.value.push(item)

    return item
  }

  const update = async (id: string, data: Partial<GalleryFormData>) => {
    const item = await api.galleries.update(id, data)

    if (!item) return
    const i = galleries.value.findIndex((g) => g.id === id)

    if (i !== -1) galleries.value[i] = { ...galleries.value[i], ...item, photos: galleries.value[i].photos }
  }

  const remove = async (id: string) => {
    await api.galleries.remove(id)
    galleries.value = galleries.value.filter((g) => g.id !== id)
  }

  const reorder = async (reordered: Gallery[]) => {
    galleries.value = reordered
    await api.galleries.reorder(reordered.map((g, i) => ({ id: g.id, sortOrder: i })))
  }

  // ─── Photos ───────────────────────────────────────────────────

  const uploadPhoto = async (galleryId: string, file: File): Promise<GalleryPhoto | null> => {
    if (!tenantId.value) return null
    const gallery = galleries.value.find((g) => g.id === galleryId)

    if (!gallery) return null

    const photo = await api.galleries.addPhoto(galleryId, tenantId.value, gallery.photos.length)

    if (!photo) return null

    const url = await api.galleries.uploadPhoto(tenantId.value, file, galleryId, photo.id)
    const updated = await api.galleries.updatePhoto(photo.id, { url })

    if (!updated) return null

    const i = galleries.value.findIndex((g) => g.id === galleryId)

    if (i !== -1) galleries.value[i].photos.push(updated)

    return updated
  }

  const removePhoto = async (galleryId: string, photoId: string) => {
    await api.galleries.removePhoto(photoId)
    const i = galleries.value.findIndex((g) => g.id === galleryId)

    if (i !== -1) {
      galleries.value[i].photos = galleries.value[i].photos.filter((p) => p.id !== photoId)
    }
  }

  const reorderPhotos = async (galleryId: string, reordered: GalleryPhoto[]) => {
    const i = galleries.value.findIndex((g) => g.id === galleryId)

    if (i !== -1) galleries.value[i].photos = reordered
    await api.galleries.reorderPhotos(reordered.map((p, idx) => ({ id: p.id, sortOrder: idx })))
  }

  fetch()

  return { galleries, loading, fetch, add, update, remove, reorder, uploadPhoto, removePhoto, reorderPhotos }
}
