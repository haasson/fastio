<template>
  <div class="category-list-root">
    <UiSkeleton v-if="loading" :height="56" :count="3" />
    <UiEmpty v-else-if="categories.length === 0" icon="layoutGrid" :text="emptyText" />
    <AppDraggableList v-else v-model="localCategories" @reorder="$emit('reorder', localCategories)">
      <AppListRow
        v-for="cat in localCategories"
        :key="cat.id"
        :name="cat.name"
        :thumb-url="showThumbs ? (cat.photoUrl ?? null) : undefined"
        thumb-width="36px"
        thumb-height="36px"
        :disabled="!cat.active"
      >
        <template #name>
          <div class="name-row">
            <UiText size="small" weight="medium">{{ cat.name }}</UiText>
            <UiTag v-if="cat.type && cat.type !== 'regular'" size="tiny" type="warning">
              {{ CATEGORY_TYPE_LABELS[cat.type as SpecialCategoryType] }}
            </UiTag>
            <UiTag
              v-if="cat.tagId && tagName(cat.tagId)"
              size="tiny"
              empty
              round
              :style="tagStyle(cat.tagId)"
            >{{ tagName(cat.tagId) }}</UiTag>
          </div>
        </template>
        <template v-if="countText" #default>
          <UiText size="tiny" color="tertiary">
            {{ countText(itemCounts?.[cat.id] ?? 0) }}
          </UiText>
        </template>
        <template #append>
          <UiSwitch
            :model-value="cat.active"
            @update:model-value="$emit('toggleActive', cat.id, $event)"
          />
          <AppActionsBlock @edit="$emit('edit', cat)" @delete="$emit('delete', cat.id)" />
        </template>
      </AppListRow>
    </AppDraggableList>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiSkeleton, UiEmpty, UiText, UiTag, UiSwitch } from '@fastio/ui'
import type { SpecialCategoryType, DishTagDefinition } from '@fastio/shared'
import { CATEGORY_TYPE_LABELS } from '@fastio/shared'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import { useTagDisplay } from '~/features/catalog'

export type CategoryListItem = {
  id: string
  name: string
  active: boolean
  photoUrl?: string | null
  type?: string
  tagId?: string | null
}

const props = withDefaults(defineProps<{
  categories: CategoryListItem[]
  loading: boolean
  itemCounts?: Record<string, number>
  countText?: (count: number) => string
  tags?: DishTagDefinition[]
  showThumbs?: boolean
  emptyText?: string
}>(), {
  itemCounts: undefined,
  countText: undefined,
  tags: undefined,
  showThumbs: false,
  emptyText: 'Категорий пока нет. Создайте первую — она появится в списке.',
})

defineEmits<{
  edit: [category: CategoryListItem]
  delete: [id: string]
  reorder: [categories: CategoryListItem[]]
  toggleActive: [id: string, active: boolean]
}>()

const localCategories = ref<CategoryListItem[]>([])

watch(() => props.categories, (v) => {
  localCategories.value = v.map((c) => ({ ...c }))
}, { immediate: true, deep: true })

const { tagName, tagStyle } = useTagDisplay(computed(() => props.tags ?? []))
</script>

<style scoped lang="scss">
.category-list-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.name-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}
</style>
