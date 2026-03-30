<template>
  <div class="category-list-root">
    <UiSkeleton v-if="loading" :height="56" :count="3" />
    <UiEmpty v-else-if="categories.length === 0" text="Нет категорий" />
    <AppDraggableList v-else v-model="localCategories" @reorder="$emit('reorder', localCategories)">
      <AppListRow
        v-for="cat in localCategories"
        :key="cat.id"
        :name="cat.name"
        :thumb-url="cat.photoUrl"
        thumb-width="36px"
        thumb-height="36px"
        :disabled="!cat.active"
      >
        <template #name>
          <div class="name-row">
            <UiText size="small" weight="medium">{{ cat.name }}</UiText>
            <UiTag v-if="cat.type !== 'regular'" size="tiny" type="warning">
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
        <template v-if="dishCounts" #default>
          <UiText size="tiny" color="tertiary">
            {{ dishCounts[cat.id] ?? 0 }} {{ itemsLabelGen }}
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
import type { Category, SpecialCategoryType, DishTagDefinition } from '@fastio/shared'
import { CATEGORY_TYPE_LABELS } from '@fastio/shared'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import { useTagDisplay } from '~/composables/ui/useTagDisplay'
import { useTenantLabels } from '~/composables/plan/useTenantLabels'

const props = defineProps<{
  categories: Category[]
  loading: boolean
  dishCounts?: Record<string, number>
  tags?: DishTagDefinition[]
}>()

defineEmits<{
  edit: [category: Category]
  delete: [id: string]
  reorder: [categories: Category[]]
  toggleActive: [id: string, active: boolean]
}>()

const localCategories = ref<Category[]>([])

watch(() => props.categories, (v) => {
  localCategories.value = v.map((c) => ({ ...c }))
}, { immediate: true })

const { tagName, tagStyle } = useTagDisplay(computed(() => props.tags ?? []))
const { itemsLabelGen } = useTenantLabels()
</script>

<style scoped lang="scss">
.category-list-root {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
