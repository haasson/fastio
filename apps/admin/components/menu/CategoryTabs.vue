<template>
  <div class="categories-root">
    <UiSkeleton
      v-if="categoriesLoading"
      text
      :repeat="3"
      class="skeleton"
    />

    <template v-else>
      <UiEmpty
        v-if="categories.length === 0"
        icon="layoutGrid"
        :text="`Добавлять ${itemsLabelLower} пока некуда — сначала создайте категорию.`"
      />
      <UiTabs
        v-else
        variant="pill"
        :model-value="modelValue ?? ''"
        :tabs="categoryTabs"
        @update:model-value="$emit('update:modelValue', String($event))"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, toRefs, watch } from 'vue'
import { UiEmpty, UiSkeleton, UiTabs } from '@fastio/ui'
import type { Category, DishTagDefinition } from '@fastio/shared'
import { isAutoCategory } from '@fastio/shared'
import { useCategories } from '~/composables/data/useCategories'
import { useTenantLabels } from '~/composables/plan/useTenantLabels'

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

const { itemsLabelLower } = useTenantLabels()
const { tenantId: tenantIdRef } = toRefs(props)

const { categories, loading: categoriesLoading } = useCategories(tenantIdRef)

watch(categories, (cats) => emit('categoriesLoaded', cats), { immediate: true })

const { dishCounts: dishCountByCategory } = toRefs(props)

const categoryTabs = computed(() => categories.value.map((c) => ({
  value: c.id,
  label: c.name,
  count: dishCountByCategory.value[c.id] ?? 0,
  attrs: { 'data-tour': 'category-tab', 'data-category-type': isAutoCategory(c) ? 'virtual' : (c.type ?? 'regular') },
  ...((c.type !== 'regular' || isAutoCategory(c)) && { type: 'warning' as const }),
})))
</script>

<style scoped lang="scss">
.categories-root {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding-bottom: var(--space-8);
  margin-bottom: var(--space-8);
  border-bottom: 1px dashed var(--color-border);
}

.skeleton {
  padding: 0;
}
</style>
