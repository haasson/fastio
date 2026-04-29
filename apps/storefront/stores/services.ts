import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Category, DishTagDefinition } from '@fastio/shared'

export type ServiceCard = {
  id: string
  tenantId: string
  categoryId: string | null
  name: string
  description: string
  price: number
  duration: number
  photos: string[]
  tags: string[]
  isBookable: boolean
  bookingMode: 'fixed' | 'open_ended'
  allowResourceChoice: boolean
  branchIds: string[]
}

type ServicesCatalogData = {
  categories: Category[]
  services: ServiceCard[]
  tagDefinitions: DishTagDefinition[]
  tagDisplayMode: 'text' | 'icon' | 'both'
}

export const useServicesStore = defineStore('services', () => {
  const { data } = useNuxtData<ServicesCatalogData>('services-catalog')

  const allServices = computed(() => data.value?.services ?? [])
  const allCategories = computed(() => data.value?.categories ?? [])
  const tagDefinitions = computed(() => data.value?.tagDefinitions ?? [])
  const tagDisplayMode = computed(() => data.value?.tagDisplayMode ?? 'both')

  const servicesByCategory = computed<Record<string, ServiceCard[]>>(() =>
    allServices.value.reduce<Record<string, ServiceCard[]>>((acc, svc) => {
      if (!svc.categoryId) return acc
      ;(acc[svc.categoryId] ??= []).push(svc)
      return acc
    }, {}),
  )

  const visibleCategories = computed<Category[]>(() =>
    allCategories.value.filter((c) => (servicesByCategory.value[c.id]?.length ?? 0) > 0),
  )

  return {
    allServices,
    allCategories,
    tagDefinitions,
    tagDisplayMode,
    servicesByCategory,
    visibleCategories,
  }
})
