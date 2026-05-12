import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { BranchPublic, Category, Dish, Combo, DishModifierGroup, DishTagDefinition } from '@fastio/shared'

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
  comboItems: Record<string, { name: string; photo: string | null; modifier: string | null; addons: string | null }[]>
  tagDefinitions: DishTagDefinition[]
  tagDisplayMode: 'text' | 'icon' | 'both'
  maxAddonsDefault: number | null
}

export const useMenuStore = defineStore('menu', () => {
  const { data: menu } = useNuxtData<MenuData>('menu')
  const { data: branchesData } = useNuxtData<BranchPublic[]>('branches')

  const allDishes = computed(() => menu.value?.dishes ?? [])
  const allCombos = computed(() => menu.value?.combos ?? [])
  const allCategories = computed(() => menu.value?.categories ?? [])
  const dishModifiers = computed(() => menu.value?.dishModifiers ?? {})
  const dishAddons = computed(() => menu.value?.dishAddons ?? {})
  const comboItems = computed(() => menu.value?.comboItems ?? {})
  const tagDefinitions = computed(() => menu.value?.tagDefinitions ?? [])
  const tagDisplayMode = computed(() => menu.value?.tagDisplayMode ?? 'both')
  const maxAddonsDefault = computed(() => menu.value?.maxAddonsDefault ?? null)

  const dishesByCategory = computed<Record<string, Dish[]>>(() => {
    const byId = allDishes.value.reduce<Record<string, Dish[]>>((acc, dish) => {
      ;(acc[dish.categoryId] ??= []).push(dish)
      return acc
    }, {})

    // Categories with tagId: fill with dishes that have that tag
    for (const cat of allCategories.value) {
      if (cat.tagId) {
        byId[cat.id] = allDishes.value.filter((d) => d.tags.includes(cat.tagId!))
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

  const branchesAll = computed<BranchPublic[]>(() => branchesData.value ?? [])

  // Пустой branchIds = «во всех филиалах» (как ServiceWithBranchIds).
  // Длина равная числу филиалов трактуется так же — селектор просто перечислил всех.
  const dishAvailableBranchIds = (dish: Dish): string[] =>
    dish.branchIds.length === 0 ? branchesAll.value.map((b) => b.id) : dish.branchIds

  const comboAvailableBranchIds = (combo: Combo): string[] =>
    combo.branchIds.length === 0 ? branchesAll.value.map((b) => b.id) : combo.branchIds

  const isDishEverywhere = (dish: Dish): boolean =>
    dish.branchIds.length === 0 || dish.branchIds.length === branchesAll.value.length

  const isComboEverywhere = (combo: Combo): boolean =>
    combo.branchIds.length === 0 || combo.branchIds.length === branchesAll.value.length

  return {
    allDishes,
    allCombos,
    dishModifiers,
    dishAddons,
    comboItems,
    tagDefinitions,
    tagDisplayMode,
    maxAddonsDefault,
    dishesByCategory,
    combosByCategory,
    visibleCategories,
    branchesAll,
    dishAvailableBranchIds,
    comboAvailableBranchIds,
    isDishEverywhere,
    isComboEverywhere,
  }
})
