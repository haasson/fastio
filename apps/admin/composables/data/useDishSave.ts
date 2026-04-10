import { type Ref } from 'vue'
import type { DishModifierGroup } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

export const useDishSave = (tenantId: Ref<string>) => {
  const api = useDatabase()

  const uploadPhoto = (file: File) => api.dishes.uploadPhoto(tenantId.value, file)

  const deletePhoto = (url: string) => api.dishes.deletePhoto(url)

  const saveDishModifiers = (dishId: string, modifiers: DishModifierGroup[]) => api.dishes.setDishModifiers(dishId, modifiers)

  const saveDishAddons = (dishId: string, addonIds: string[]) => api.addons.setDishAddons(dishId, addonIds)

  return { uploadPhoto, deletePhoto, saveDishModifiers, saveDishAddons }
}
