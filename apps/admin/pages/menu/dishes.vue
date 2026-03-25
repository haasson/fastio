<template>
  <template v-if="tenantStore.tenant">
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
</template>

<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue'
import type { Category } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import useDishCounts from '~/composables/data/useDishCounts'
import MenuCategoryList from '~/components/menu/CategoryList.vue'
import MenuDishList from '~/components/menu/DishList.vue'
import MenuComboList from '~/components/menu/ComboList.vue'
import MenuVirtualDishList from '~/components/menu/VirtualDishList.vue'

const tenantStore = useTenantStore()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')

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
