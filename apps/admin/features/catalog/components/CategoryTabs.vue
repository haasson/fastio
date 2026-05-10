<template>
  <div class="categories-root">
    <UiSkeleton
      v-if="loading"
      text
      :repeat="3"
      class="skeleton"
    />

    <template v-else>
      <UiEmpty v-if="categories.length === 0" icon="layoutGrid">
        Добавлять {{ item.plural.nom }} пока некуда — сначала
        <RouterLink :to="emptyLink" class="link">создайте категорию</RouterLink>.
      </UiEmpty>
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
import { computed, toRefs } from 'vue'
import { UiEmpty, UiSkeleton, UiTabs } from '@fastio/ui'
import type { Category } from '@fastio/shared'
import { isAutoCategory } from '@fastio/shared'
import { useTerms } from '~/features/legal'

const props = withDefaults(defineProps<{
  modelValue: string | null
  categories: Category[]
  loading?: boolean
  itemCounts?: Record<string, number>
  emptyLink?: string
}>(), {
  loading: false,
  itemCounts: () => ({}),
  emptyLink: '/menu/categories',
})

defineEmits<{
  'update:modelValue': [id: string | null]
}>()

const { item } = useTerms()
const { itemCounts } = toRefs(props)

const categoryTabs = computed(() => props.categories.map((c) => ({
  value: c.id,
  label: c.name,
  count: itemCounts.value[c.id] ?? 0,
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

.link {
  color: var(--color-primary);
  text-decoration: underline;
}
</style>
