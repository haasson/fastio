<template>
  <UiCollapseItem name="composition" title="Состав комбо">
    <UiSelect
      :value="modelValue"
      multiple
      filterable
      :options="dishOptions"
      placeholder="Выберите блюда"
      :loading="loading"
      @update:value="$emit('update:modelValue', $event as string[])"
    />
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiCollapseItem, UiSelect } from '@fastio/ui'
import type { Category } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

const props = defineProps<{
  modelValue: string[]
  tenantId: string
  categories: Category[]
  refreshKey: number
}>()

defineEmits<{ 'update:modelValue': [value: string[]] }>()

const api = useDatabase()
const loading = ref(false)
const allDishes = ref<{ id: string; name: string; categoryId: string }[]>([])

const dishOptions = computed(() => {
  const byCategory = new Map<string, { label: string; value: string }[]>()

  for (const d of allDishes.value) {
    if (!byCategory.has(d.categoryId)) byCategory.set(d.categoryId, [])
    byCategory.get(d.categoryId)!.push({ label: d.name, value: d.id })
  }

  return props.categories
    .filter((c) => c.type === 'regular' && byCategory.has(c.id))
    .map((c) => ({
      type: 'group' as const,
      label: c.name,
      key: c.id,
      children: byCategory.get(c.id)!,
    }))
})

watch(() => props.refreshKey, async () => {
  if (!props.tenantId) return
  loading.value = true
  const dishes = await api.dishes.listAllActive(props.tenantId)

  allDishes.value = dishes.map((d) => ({ id: d.id, name: d.name, categoryId: d.categoryId }))
  loading.value = false
}, { immediate: true })
</script>
