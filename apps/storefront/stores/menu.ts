import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Category, Dish, Combo, DishModifierGroup } from '@fastio/shared'

export type ClientAddon = {
  id: string
  name: string
  weight: number | null
  price: number
  order: number
}

type MenuData = {
  categories: Category[]
  dishes: Dish[]
  combos: Combo[]
  dishModifiers: Record<string, DishModifierGroup[]>
  dishAddons: Record<string, ClientAddon[]>
  comboItems: Record<string, { name: string; photo: string | null; modifier: string | null }[]>
}

export const useMenuStore = defineStore('menu', () => {
  const { data: menu } = useNuxtData<MenuData>('menu')

  const allDishes = computed(() => menu.value?.dishes ?? [])
  const allCombos = computed(() => menu.value?.combos ?? [])
  const allCategories = computed(() => menu.value?.categories ?? [])
  const dishModifiers = computed(() => menu.value?.dishModifiers ?? {})
  const dishAddons = computed(() => menu.value?.dishAddons ?? {})
  const comboItems = computed(() => menu.value?.comboItems ?? {})

  const dishesByCategory = computed<Record<string, Dish[]>>(() => {
    const byId = allDishes.value.reduce<Record<string, Dish[]>>((acc, dish) => {
      ;(acc[dish.categoryId] ??= []).push(dish)
      return acc
    }, {})

    // Virtual categories: filled by tags, not categoryId
    for (const cat of allCategories.value) {
      if (cat.type === 'new') {
        byId[cat.id] = allDishes.value.filter((d) => d.tags.includes('new'))
      } else if (cat.type === 'hit') {
        byId[cat.id] = allDishes.value.filter((d) => d.tags.includes('hit') || d.tags.includes('popular'))
      }
    }

    return byId
  })

  const combosByCategory = computed<Record<string, Combo[]>>(() =>
    allCombos.value.reduce<Record<string, Combo[]>>((acc, combo) => {
      ;(acc[combo.categoryId] ??= []).push(combo)
      return acc
    }, {}),
  )

  const visibleCategories = computed<Category[]>(() =>
    allCategories.value.filter((c) => {
      if (c.type === 'combo') return (combosByCategory.value[c.id]?.length ?? 0) > 0
      return (dishesByCategory.value[c.id]?.length ?? 0) > 0
    }),
  )

  return { allDishes, allCombos, dishModifiers, dishAddons, comboItems, dishesByCategory, combosByCategory, visibleCategories }
})
