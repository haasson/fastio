<template>
  <div class="categories-root">
    <div class="toolbar">
      <UiButton type="primary" icon="plus" @click="openModal(null)">Добавить категорию</UiButton>
    </div>

    <AppCategoryList
      :categories="categories"
      :loading="showSkeleton"
      :item-counts="counts"
      :count-text="countText"
      :tags="tags"
      show-thumbs
      empty-text="Категорий пока нет. Создайте первую — она появится в списке услуг."
      @edit="openModal($event as Category)"
      @delete="confirmDelete"
      @reorder="onReorder"
      @toggle-active="toggleActive"
    />

    <CategoryFormModal
      v-model="modalOpen"
      :tenant-id="tenantId"
      :category="editingItem"
      :tags="tags"
      kind="service"
      @saved="refresh"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton } from '@fastio/ui'
import type { Category } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useCategories } from '~/composables/data/useCategories'
import { useTags } from '~/composables/data/useTags'
import { useDatabase } from '~/composables/data/useDatabase'
import { useItemManager } from '~/composables/ui/useItemManager'
import AppCategoryList from '~/components/ui/AppCategoryList.vue'
import CategoryFormModal from '~/components/menu/CategoryFormModal.vue'

const { tenantId } = storeToRefs(useTenantStore())
const api = useDatabase()

const { categories, loading, update, remove, reorder, refresh } = useCategories(tenantId, 'service')
const { tags } = useTags(tenantId)

const counts = ref<Record<string, number>>({})

const refreshCounts = async () => {
  if (!tenantId.value) {
    counts.value = {}

    return
  }
  counts.value = await api.services.countsByCategory(tenantId.value)
}

watch([tenantId, categories], () => {
  refreshCounts()
}, { immediate: true })

const { showSkeleton, modalOpen, editingItem, openModal, confirmDelete } = useItemManager<Category>({
  loading,
  remove: async (id: string) => await remove(id),
  confirmTitle: 'Удалить категорию?',
  beforeDelete: (id) => {
    const hasServices = (counts.value[id] ?? 0) > 0

    if (hasServices) return {
      alert: 'В этой категории есть услуги. Сначала переместите их в другую категорию.',
      disabled: true,
    }
  },
})

const toggleActive = (id: string, active: boolean) => update(id, { active })

const onReorder = (next: { id: string }[]) => {
  const map = new Map(categories.value.map((c) => [c.id, c]))
  const reordered = next.map((c) => map.get(c.id)).filter((c): c is Category => !!c)

  reorder(reordered)
}

const pluralServices = (n: number) => {
  const mod10 = n % 10
  const mod100 = n % 100

  if (mod10 === 1 && mod100 !== 11) return 'услуга'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'услуги'

  return 'услуг'
}

const countText = (n: number) => `${n} ${pluralServices(n)}`
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
