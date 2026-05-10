import { ref, type Ref } from 'vue'
import type { Banner, BannerFormData } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'

export function useBanners(tenantId: Ref<string>) {
  const api = useDatabase()

  const banners = ref<Banner[]>([])
  const loading = ref(false)

  const fetch = async () => {
    if (!tenantId.value) return
    loading.value = true
    try {
      banners.value = await api.banners.list(tenantId.value)
    } finally {
      loading.value = false
    }
  }

  const add = async (data: BannerFormData): Promise<Banner | null> => {
    if (!tenantId.value) return null
    const item = await api.banners.add(tenantId.value, data, banners.value.length)

    if (item) banners.value.push(item)

    return item
  }

  const update = async (id: string, data: Partial<BannerFormData>) => {
    const item = await api.banners.update(id, data)

    if (!item) return
    const i = banners.value.findIndex((b) => b.id === id)

    if (i !== -1) banners.value[i] = item
  }

  const remove = async (id: string) => {
    await api.banners.remove(id)
    banners.value = banners.value.filter((b) => b.id !== id)
  }

  const toggleEnabled = async (id: string, enabled: boolean) => {
    const item = banners.value.find((b) => b.id === id)

    if (item) item.enabled = enabled
    try {
      await api.banners.update(id, { enabled })
    } catch (e) {
      if (item) item.enabled = !enabled
      throw e
    }
  }

  const reorder = async (reordered: Banner[]) => {
    banners.value = reordered
    await api.banners.reorder(reordered.map((b, i) => ({ id: b.id, sortOrder: i })))
  }

  const uploadImage = async (id: string, file: File): Promise<string> => api.banners.uploadImage(tenantId.value, file, id)

  fetch()

  return { banners, loading, fetch, add, update, remove, toggleEnabled, reorder, uploadImage }
}
