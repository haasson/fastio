<template>
  <CategoryTabs
    v-model="selectedCategoryId"
    :categories="categories"
    :loading="categoriesLoading"
    :item-counts="counts"
    empty-link="/services/categories"
  />

  <AppMenuItemList
    :items="services"
    :loading="showSkeleton || servicesLoading"
    :category-id="selectedCategoryId"
    :tags="tags"
    title="Услуги"
    empty-text="В этой категории пока нет услуг"
    empty-hint-text="Выберите категорию"
    storage-key="services:item-view"
    :enabled-views="['cards', 'order']"
    @add="openDrawer(null)"
    @edit="openDrawer($event as ServiceWithBranchIds)"
    @delete="confirmDeleteService"
    @toggle-active="toggleActive"
    @reorder="reorder"
  />

  <ServiceDrawer
    v-if="categories.length > 0"
    v-model="drawerOpen"
    :service="editingService"
    :initial-category-id="selectedCategoryId"
    :categories="categories"
    :do-update="update"
    @saved="onSaved"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import type { ServiceWithBranchIds } from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useCategories } from '~/features/catalog'
import { useServices } from '~/features/services-catalog'
import { useTags } from '~/features/catalog'
import { useItemManager } from '~/shared/ui/composables/useItemManager'
import { useDatabase } from '~/shared/data/useDatabase'
import CategoryTabs from '~/features/catalog/components/CategoryTabs.vue'
import AppMenuItemList from '~/features/catalog/components/AppMenuItemList.vue'
import ServiceDrawer from '~/features/services-catalog/components/ServiceDrawer.vue'

const { tenantId } = storeToRefs(useTenantStore())
const api = useDatabase()

const selectedCategoryId = ref<string | null>(null)

const { categories, loading: categoriesLoading } = useCategories(tenantId, 'service')
const { tags } = useTags(tenantId)
const { services, loading: servicesLoading, remove, update, toggleActive: rawToggleActive, reorder: rawReorder }
  = useServices(tenantId, selectedCategoryId)

const counts = ref<Record<string, number>>({})

const refreshCounts = async () => {
  if (!tenantId.value) {
    counts.value = {}

    return
  }
  counts.value = await api.services.countsByCategory(tenantId.value)
}

watch([tenantId, services], () => {
  refreshCounts()
}, { immediate: true })

watchEffect(() => {
  if (!selectedCategoryId.value && categories.value.length > 0) {
    selectedCategoryId.value = categories.value[0].id
  }
})

const { showSkeleton, modalOpen: drawerOpen, editingItem: editingService, openModal: openDrawer, closeModal: closeDrawer, confirmDelete: confirmDeleteService }
  = useItemManager<ServiceWithBranchIds>({
    loading: servicesLoading,
    remove: async (id: string) => { await remove(id) },
    confirmTitle: 'Удалить услугу?',
  })

const toggleActive = (id: string, active: boolean) => rawToggleActive(id, active)
const reorder = (next: ServiceWithBranchIds[]) => rawReorder(next)
const onSaved = () => {
  closeDrawer()
  refreshCounts()
}
</script>
