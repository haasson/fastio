import { ref, computed, watch, type Ref } from 'vue'
import type { Dish, ModifierGroup, DishModifierGroup, DishModifierOption } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

export const useDishModifiersEditor = (
  tenantId: Ref<string>,
  categoryId: Ref<string>,
  dishId: Ref<string | null>,
  refreshKey: Ref<number>,
) => {
  const api = useDatabase()

  const loading = ref(false)
  const availableGroups = ref<ModifierGroup[]>([])
  const attachedGroups = ref<DishModifierGroup[]>([])
  const selectedGroupId = ref<string | null>(null)
  const copyFromDishId = ref<string | null>(null)
  const categoryDishes = ref<Dish[]>([])
  const dishesWithModifiers = ref<Set<string>>(new Set())
  const addMode = ref<'group' | 'copy' | null>(null)

  const unattachedGroups = computed(() => availableGroups.value.filter((g) => !attachedGroups.value.some((a) => a.groupId === g.id) && g.active),
  )

  const isGroupInactive = (groupId: string) => availableGroups.value.find((g) => g.id === groupId)?.active === false

  const canAddGroup = computed(() => unattachedGroups.value.length > 0)

  const copyDishSelectOptions = computed(() => categoryDishes.value
    .filter((d) => dishesWithModifiers.value.has(d.id))
    .map((d) => ({ label: d.name, value: d.id })),
  )

  const hasCopySource = computed(() => copyDishSelectOptions.value.length > 0)

  const groupSelectOptions = computed(() => unattachedGroups.value.map((g) => ({ label: g.name, value: g.id })),
  )

  const loadAvailableGroups = async () => {
    if (!tenantId.value) return
    availableGroups.value = await api.modifiers.list(tenantId.value)
  }

  const loadCategoryDishes = async () => {
    if (!tenantId.value || !categoryId.value) return
    const dishes = await api.dishes.list(tenantId.value, categoryId.value)

    categoryDishes.value = dishes.filter((d) => d.id !== dishId.value)
    const dishIds = categoryDishes.value.map((d) => d.id)

    if (dishIds.length > 0) {
      dishesWithModifiers.value = await api.dishes.getDishIdsWithModifiers(dishIds)
    }
  }

  const loadDishModifiers = async (id: string) => {
    attachedGroups.value = await api.dishes.getDishModifiers(id)
  }

  const copyFromDish = async () => {
    if (!copyFromDishId.value) return
    attachedGroups.value = await api.dishes.getDishModifiers(copyFromDishId.value)
    copyFromDishId.value = null
    addMode.value = null
  }

  const getGroupWeightMode = (groupId: string) => {
    const g = availableGroups.value.find((g) => g.id === groupId)

    return { affectsWeight: g?.affectsWeight ?? false, weightMode: g?.weightMode ?? 'per_dish' }
  }

  const addGroup = () => {
    const group = availableGroups.value.find((g) => g.id === selectedGroupId.value)

    if (!group) return

    const options: DishModifierOption[] = group.options.map((o, i) => ({
      optionId: o.id,
      optionName: o.name,
      groupId: group.id,
      groupName: group.name,
      priceDelta: 0,
      weight: group.affectsWeight && group.weightMode === 'global' ? (o.weight ?? null) : null,
      isDefault: i === 0,
      sortOrder: i,
      active: true,
    }))

    attachedGroups.value.push({ groupId: group.id, groupName: group.name, sortOrder: attachedGroups.value.length, options })
    selectedGroupId.value = null
    addMode.value = null
  }

  const removeGroup = (index: number) => attachedGroups.value.splice(index, 1)

  const getGroupSourceOptions = (groupId: string) => availableGroups.value.find((g) => g.id === groupId)?.options ?? []

  const isOptionAttached = (groupIndex: number, optionId: string) => attachedGroups.value[groupIndex].options.some((o) => o.optionId === optionId && o.active)

  const getAttachedOption = (groupIndex: number, optionId: string) => attachedGroups.value[groupIndex].options.find((o) => o.optionId === optionId && o.active)

  const toggleOption = (groupIndex: number, sourceOpt: { id: string; name: string; weight?: number | null }, checked: boolean) => {
    const group = attachedGroups.value[groupIndex]
    const existing = group.options.find((o) => o.optionId === sourceOpt.id)

    if (checked) {
      if (existing) {
        // Restore previously disabled option with its saved price
        existing.active = true
        const activeOptions = group.options.filter((o) => o.active)

        if (!activeOptions.some((o) => o.isDefault)) existing.isDefault = true
      } else {
        const { affectsWeight, weightMode } = getGroupWeightMode(group.groupId)
        const weight = affectsWeight && weightMode === 'global' ? (sourceOpt.weight ?? null) : null

        group.options.push({
          optionId: sourceOpt.id, optionName: sourceOpt.name,
          groupId: group.groupId, groupName: group.groupName,
          priceDelta: 0, weight, isDefault: group.options.filter((o) => o.active).length === 0, sortOrder: group.options.length,
          active: true,
        })
      }
    } else {
      if (existing) {
        existing.active = false
        existing.isDefault = false
      }
      const activeOptions = group.options.filter((o) => o.active)

      if (!activeOptions.some((o) => o.isDefault) && activeOptions.length > 0) {
        activeOptions[0].isDefault = true
      }
    }
  }

  const setDefault = (groupIndex: number, optionId: string, value: boolean) => {
    const group = attachedGroups.value[groupIndex]

    for (const opt of group.options) opt.isDefault = opt.optionId === optionId ? value : false
    if (!group.options.some((o) => o.isDefault) && group.options.length > 0) {
      group.options[0].isDefault = true
    }
  }

  const getModifiers = (): DishModifierGroup[] => attachedGroups.value

  watch(refreshKey, async () => {
    loading.value = true
    try {
      await Promise.all([loadAvailableGroups(), loadCategoryDishes()])
      if (dishId.value) {
        await loadDishModifiers(dishId.value)

        const availableIds = new Set(availableGroups.value.map((g) => g.id))

        attachedGroups.value = attachedGroups.value.filter((g) => availableIds.has(g.groupId))
      } else {
        attachedGroups.value = []
      }
    } finally {
      loading.value = false
    }
  }, { immediate: true })

  return {
    loading,
    availableGroups,
    attachedGroups,
    selectedGroupId,
    copyFromDishId,
    categoryDishes,
    addMode,
    canAddGroup,
    hasCopySource,
    groupSelectOptions,
    copyDishSelectOptions,
    copyFromDish,
    addGroup,
    removeGroup,
    getGroupSourceOptions,
    getGroupWeightMode,
    isOptionAttached,
    getAttachedOption,
    isGroupInactive,
    toggleOption,
    setDefault,
    getModifiers,
  }
}
