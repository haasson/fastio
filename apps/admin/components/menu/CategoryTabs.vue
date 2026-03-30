<template>
  <div class="categories-root">
    <UiSkeleton
      v-if="categoriesLoading"
      text
      :repeat="3"
      class="skeleton"
    />

    <UiTabs
      v-else
      variant="pill"
      :model-value="modelValue ?? ''"
      :tabs="categoryTabs"
      @update:model-value="$emit('update:modelValue', String($event))"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs, watch } from 'vue'
import { UiSkeleton, UiTabs } from '@fastio/ui'
import type { Category, DishTagDefinition } from '@fastio/shared'
import { useCategories } from '~/composables/data/useCategories'

const props = defineProps<{
  tenantId: string
  modelValue: string | null
  dishCounts: Record<string, number>
  tags: DishTagDefinition[]
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string | null]
  'categoriesLoaded': [cats: Category[]]
}>()

const { tenantId: tenantIdRef } = toRefs(props)

const { categories, loading: categoriesLoading } = useCategories(tenantIdRef)

watch(categories, (cats) => emit('categoriesLoaded', cats), { immediate: true })

const { dishCounts: dishCountByCategory } = toRefs(props)

const categoryTabs = computed(() => categories.value.map((c) => ({
  value: c.id,
  label: c.name,
  count: dishCountByCategory.value[c.id] ?? 0,
  attrs: { 'data-tour': 'category-tab', 'data-category-type': c.tagId ? 'virtual' : (c.type ?? 'regular') },
  ...((c.type !== 'regular' || c.tagId) && { type: 'warning' as const }),
})))
</script>

<style scoped lang="scss">
.categories-root {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px dashed var(--color-border);
}

.skeleton {
  padding: 0;
}
</style>
