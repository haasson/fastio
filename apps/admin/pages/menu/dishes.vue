<template>
  <template v-if="tenantStore.tenant">
    <MenuCategoryList
      v-model="selectedCategoryId"
      :tenant-id="tenantId"
      :dish-counts="dishCounts"
      :tags="tags"
      @categories-loaded="onCategoriesLoaded"
    />
    <MenuDishList
      v-if="selectedCategory?.type === 'regular' && !selectedCategory.tagId"
      :tenant-id="tenantId"
      :category-id="selectedCategoryId"
      :categories="loadedCategories"
      :tags="tags"
      @dishes-changed="refreshDishCounts"
    />
    <MenuComboList
      v-else-if="selectedCategory?.type === 'combo'"
      :tenant-id="tenantId"
      :category-id="selectedCategoryId!"
      :categories="loadedCategories"
      :tags="tags"
      @combos-changed="refreshDishCounts"
    />
    <MenuVirtualDishList
      v-else-if="selectedCategory?.tagId"
      :tenant-id="tenantId"
      :tag-id="selectedCategory.tagId"
      :category-name="selectedCategory.name"
      :categories="loadedCategories"
      :all-tags="tags"
    />
    <MenuDishList
      v-else-if="!selectedCategory"
      :tenant-id="tenantId"
      :category-id="null"
      :categories="loadedCategories"
      :tags="tags"
      @dishes-changed="refreshDishCounts"
    />
  </template>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue'
import type { Category } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import useDishCounts from '~/composables/data/useDishCounts'
import { useTags } from '~/composables/data/useTags'
import MenuCategoryList from '~/components/menu/CategoryList.vue'
import MenuDishList from '~/components/menu/DishList.vue'
import MenuComboList from '~/components/menu/ComboList.vue'
import MenuVirtualDishList from '~/components/menu/VirtualDishList.vue'

const tenantStore = useTenantStore()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const selectedCategoryId = ref<string | null>(null)
const loadedCategories = shallowRef<Category[]>([])

const { tags } = useTags(tenantId)

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
