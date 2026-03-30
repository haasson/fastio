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
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiButton } from '@fastio/ui'
import type { Category } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useCategories } from '~/composables/data/useCategories'
import { useTags } from '~/composables/data/useTags'
import useDishCounts from '~/composables/data/useDishCounts'
import { useItemManager } from '~/composables/ui/useItemManager'
import MenuCategoryList from '~/components/menu/CategoryList.vue'
import MenuCategoryFormModal from '~/components/menu/CategoryFormModal.vue'

const tenantStore = useTenantStore()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const { categories, loading, update, remove, reorder } = useCategories(tenantId)
const { tags } = useTags(tenantId)
const { counts } = useDishCounts(tenantId, categories)

const { showSkeleton, modalOpen, editingItem, openModal, confirmDelete } = useItemManager<Category>({
  loading,
  remove: async (id: string) => await remove(id),
  confirmTitle: 'Удалить категорию?',
})

const toggleActive = (id: string, active: boolean) => update(id, { active })
</script>

<style scoped lang="scss">
.categories-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
