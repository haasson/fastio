<template>
  <div class="menu-root">
    <UiTabs v-model="activeTab" :tabs="tabs" prevent-compact />

    <template v-if="tenantStore.tenant">
      <template v-if="activeTab === 'dishes'">
        <MenuCategoryList
          v-model="selectedCategoryId"
          :tenant-id="tenantId"
          :dish-counts="dishCounts"
          @categories-loaded="onCategoriesLoaded"
        />
        <MenuDishList
          v-if="selectedCategory?.type === 'regular'"
          :tenant-id="tenantId"
          :category-id="selectedCategoryId"
          :categories="loadedCategories"
          @dishes-changed="refreshDishCounts"
        />
        <MenuComboList
          v-else-if="selectedCategory?.type === 'combo'"
          :tenant-id="tenantId"
          :category-id="selectedCategoryId!"
          :categories="loadedCategories"
          @combos-changed="refreshDishCounts"
        />
        <MenuVirtualDishList
          v-else-if="selectedCategory?.type === 'new'"
          :tenant-id="tenantId"
          tag="new"
          :categories="loadedCategories"
        />
        <MenuVirtualDishList
          v-else-if="selectedCategory?.type === 'hit'"
          :tenant-id="tenantId"
          tag="hit"
          :categories="loadedCategories"
        />
        <MenuDishList
          v-else-if="!selectedCategory"
          :tenant-id="tenantId"
          :category-id="null"
          :categories="loadedCategories"
          @dishes-changed="refreshDishCounts"
        />
      </template>

      <MenuModifiersTab v-else-if="activeTab === 'modifiers'" :tenant-id="tenantId" />
      <MenuAddonsTab v-else-if="activeTab === 'addons'" :tenant-id="tenantId" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, shallowRef } from 'vue'
import type { Category } from '@fastio/shared'
import { UiTabs } from '@fastio/ui'
import MenuCategoryList from '~/components/menu/CategoryList.vue'
import MenuDishList from '~/components/menu/DishList.vue'
import MenuComboList from '~/components/menu/ComboList.vue'
import MenuVirtualDishList from '~/components/menu/VirtualDishList.vue'
import MenuModifiersTab from '~/components/menu/tab/ModifiersTab.vue'
import MenuAddonsTab from '~/components/menu/tab/AddonsTab.vue'
import { useTenantStore } from '~/stores/tenant'
import useDishCounts from '~/composables/data/useDishCounts'
import { usePermissions } from '~/composables/auth/usePermissions'
import { useModules } from '~/composables/plan/useModules'

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const { canManageMenu } = usePermissions()
const modules = useModules()

const canSeeModifiers = computed(() => canManageMenu.value && modules.modifiers.value.enabled)
const canSeeAddons = computed(() => canManageMenu.value && modules.addons.value.enabled)

const tabs = computed(() => [
  { value: 'dishes', label: 'Блюда' },
  ...(canSeeModifiers.value ? [{ value: 'modifiers', label: 'Модификаторы' }] : []),
  ...(canSeeAddons.value ? [{ value: 'addons', label: 'Добавки' }] : []),
])

const activeTab = ref('dishes')

watch(tabs, (newTabs) => {
  if (!newTabs.some((t) => t.value === activeTab.value)) {
    activeTab.value = 'dishes'
  }
})

const selectedCategoryId = ref<string | null>(null)
const loadedCategories = shallowRef<Category[]>([])

const { counts: dishCounts, refresh: refreshDishCounts } = useDishCounts(tenantId, loadedCategories)

const selectedCategory = computed(() => loadedCategories.value.find((c) => c.id === selectedCategoryId.value) ?? null)

const onCategoriesLoaded = (cats: Category[]) => {
  loadedCategories.value = cats
  if (!selectedCategoryId.value && cats.length > 0) {
    selectedCategoryId.value = cats[0].id
  }
  refreshDishCounts()
}
</script>

<style scoped lang="scss">
.menu-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}
</style>
