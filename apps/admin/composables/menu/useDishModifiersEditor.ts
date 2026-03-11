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

  const unattachedGroups = computed(() => availableGroups.value.filter((g) => !attachedGroups.value.some((a) => a.groupId === g.id)),
  )

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

  const addGroup = () => {
    const group = availableGroups.value.find((g) => g.id === selectedGroupId.value)

    if (!group) return

    const options: DishModifierOption[] = group.options.map((o, i) => ({
      optionId: o.id,
      optionName: o.name,
      groupId: group.id,
      groupName: group.name,
      priceDelta: 0,
      isDefault: i === 0,
      sortOrder: i,
    }))

    attachedGroups.value.push({ groupId: group.id, groupName: group.name, sortOrder: attachedGroups.value.length, options })
    selectedGroupId.value = null
    addMode.value = null
  }

  const removeGroup = (index: number) => attachedGroups.value.splice(index, 1)

  const getGroupSourceOptions = (groupId: string) => availableGroups.value.find((g) => g.id === groupId)?.options ?? []

  const isOptionAttached = (groupIndex: number, optionId: string) => attachedGroups.value[groupIndex].options.some((o) => o.optionId === optionId)

  const getAttachedOption = (groupIndex: number, optionId: string) => attachedGroups.value[groupIndex].options.find((o) => o.optionId === optionId)

  const toggleOption = (groupIndex: number, sourceOpt: { id: string; name: string }, checked: boolean) => {
    const group = attachedGroups.value[groupIndex]

    if (checked) {
      group.options.push({
        optionId: sourceOpt.id, optionName: sourceOpt.name,
        groupId: group.groupId, groupName: group.groupName,
        priceDelta: 0, isDefault: group.options.length === 0, sortOrder: group.options.length,
      })
    } else {
      group.options = group.options.filter((o) => o.optionId !== sourceOpt.id)
      if (!group.options.some((o) => o.isDefault) && group.options.length > 0) {
        group.options[0].isDefault = true
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
    isOptionAttached,
    getAttachedOption,
    toggleOption,
    setDefault,
    getModifiers,
  }
}
