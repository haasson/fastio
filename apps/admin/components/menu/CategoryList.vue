<template>
  <div class="categories-root">
    <UiSectionHeader title="Категории">
      <template #left>
        <AppEditBtn @click="managerOpen = true" />
      </template>
    </UiSectionHeader>

    <UiSkeleton
      v-if="categoriesLoading"
      text
      :repeat="3"
      class="skeleton"
    />

    <UiTabs
      v-else
      :model-value="modelValue ?? ''"
      :tabs="categoryTabs"
      @update:model-value="$emit('update:modelValue', String($event))"
    />

    <ItemManagerModal
      v-model="managerOpen"
      title="Категории"
      hint="Перетаскивайте категории для изменения порядка. Нажмите на название, чтобы переименовать."
      mode="categories"
      :items="managerItems"
      :item-counts="dishCountByCategory"
      :available-special-types="availableSpecialTypes"
      @add="handleAdd"
      @update="handleUpdate"
      @remove="handleRemove"
      @reorder="handleReorder"
      @update-photo="handleUpdatePhoto"
      @remove-photo="handleRemovePhoto"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiSkeleton, UiTabs } from '@fastio/ui'
import type { Category, CategoryType, SpecialCategoryType } from '@fastio/shared'
import { SPECIAL_CATEGORY_TYPES } from '@fastio/shared'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import AppEditBtn from '~/components/ui/AppEditBtn.vue'
import ItemManagerModal from '~/components/ui/ItemManagerModal.vue'
import type { ManagedItem } from '~/components/ui/ItemManagerModal.vue'
import { useCategories } from '~/composables/data/useCategories'

const props = defineProps<{
  tenantId: string
  modelValue: string | null
  dishCounts: Record<string, number>
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string | null]
  'categoriesLoaded': [cats: Category[]]
}>()

const tenantIdRef = computed(() => props.tenantId)

const { categories, loading: categoriesLoading, add: addCategory, update: updateCategory, remove: removeCategory, reorder: reorderCategories, updatePhoto: updateCategoryPhoto, removePhoto: removeCategoryPhoto }
  = useCategories(tenantIdRef)

watch(categories, (cats) => emit('categoriesLoaded', cats), { immediate: true })

const dishCountByCategory = computed(() => props.dishCounts)

const existingSpecialTypes = computed<SpecialCategoryType[]>(() => categories.value
  .map((c) => c.type)
  .filter((t): t is SpecialCategoryType => t !== 'regular'),
)

const availableSpecialTypes = computed<SpecialCategoryType[]>(() => SPECIAL_CATEGORY_TYPES.filter((t) => !existingSpecialTypes.value.includes(t)),
)

const categoryTabs = computed(() => categories.value.map((c) => ({
  value: c.id,
  label: c.name,
  count: dishCountByCategory.value[c.id] ?? 0,
  ...(c.type !== 'regular' && { type: 'warning' as const }),
})))

const managerOpen = ref(false)

const managerItems = computed<ManagedItem[]>(() => categories.value.map((c) => ({
  id: c.id,
  name: c.name,
  type: c.type,
  photoUrl: c.photoUrl,
})),
)

const handleAdd = async (data: Partial<ManagedItem> & { type?: CategoryType }) => {
  await addCategory(data.name!, { type: data.type })
}

const handleUpdate = async (id: string, data: Partial<ManagedItem>) => {
  await updateCategory(id, data)
}

const handleRemove = async (id: string) => {
  if (props.modelValue === id) emit('update:modelValue', null)
  await removeCategory(id)
}

const handleReorder = async (items: ManagedItem[]) => {
  await reorderCategories(items.map((item, i) => ({
    ...categories.value.find((c) => c.id === item.id)!,
    order: i,
  })))
}

const handleUpdatePhoto = (id: string, file: File) => updateCategoryPhoto(id, file)

const handleRemovePhoto = (id: string) => removeCategoryPhoto(id)
</script>

<style scoped lang="scss">
.categories-root {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--color-border);
}

.skeleton {
  padding: 0;
}
</style>
