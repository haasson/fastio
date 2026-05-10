<template>
  <div class="categories-root">
    <div class="toolbar">
      <UiButton
        data-tour="add-category"
        type="primary"
        icon="plus"
        @click="openModal(null)"
      >
        Добавить категорию
      </UiButton>
    </div>

    <MenuCategoryList
      :categories="categories"
      :loading="showSkeleton"
      :dish-counts="counts"
      :tags="tags"
      @edit="openModal"
      @delete="confirmDelete"
      @reorder="reorder"
      @toggle-active="toggleActive"
    />

    <MenuCategoryFormModal
      v-model="modalOpen"
      :tenant-id="tenantId"
      :category="editingItem"
      :tags="tags"
      @saved="refresh"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { UiButton } from '@fastio/ui'
import type { Category } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useCategories } from '~/composables/data/useCategories'
import { useTags } from '~/composables/data/useTags'
import { useDishCounts } from '~/features/menu'
import { useItemManager } from '~/composables/ui/useItemManager'
import MenuCategoryList from '~/features/menu/components/CategoryList.vue'
import MenuCategoryFormModal from '~/components/catalog/CategoryFormModal.vue'

const { tenantId } = storeToRefs(useTenantStore())

const { categories, loading, update, remove, reorder, refresh } = useCategories(tenantId)
const { tags } = useTags(tenantId)
const { counts } = useDishCounts(tenantId, categories)

const { showSkeleton, modalOpen, editingItem, openModal, confirmDelete } = useItemManager<Category>({
  loading,
  remove: async (id: string) => await remove(id),
  confirmTitle: 'Удалить категорию?',
  beforeDelete: (id) => {
    const hasDishes = (counts.value[id] ?? 0) > 0

    if (hasDishes) return {
      alert: 'В этой категории есть блюда. Сначала переместите их в другую категорию.',
      disabled: true,
    }
  },
})

const toggleActive = (id: string, active: boolean) => update(id, { active })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.categories-root {
  @include flex-col(var(--space-16));
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
