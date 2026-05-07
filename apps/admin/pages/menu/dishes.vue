<template>
  <MenuCategoryList
    v-model="selectedCategoryId"
    :categories="categories"
    :loading="categoriesLoading"
    :item-counts="dishCounts"
    empty-link="/menu/categories"
  />
  <MenuDishList
    v-if="selectedCategory?.type === 'regular' && !isAutoCategory(selectedCategory)"
    :tenant-id="tenantId"
    :category-id="selectedCategoryId"
    :categories="categories"
    :tags="tags"
    @dishes-changed="refreshDishCounts"
  />
  <MenuComboList
    v-else-if="selectedCategory?.type === 'combo'"
    :tenant-id="tenantId"
    :category-id="selectedCategoryId!"
    :categories="categories"
    :tags="tags"
    @combos-changed="refreshDishCounts"
  />
  <MenuVirtualDishList
    v-else-if="selectedCategory?.tagId"
    :tenant-id="tenantId"
    :tag-id="selectedCategory.tagId"
    :category-name="selectedCategory.name"
    :categories="categories"
    :all-tags="tags"
  />
  <MenuDishList
    v-else-if="!selectedCategory && categories.length > 0"
    :tenant-id="tenantId"
    :category-id="null"
    :categories="categories"
    :tags="tags"
    @dishes-changed="refreshDishCounts"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { isAutoCategory } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useCategories } from '~/composables/data/useCategories'
import useDishCounts from '~/composables/retail/useDishCounts'
import { useTags } from '~/composables/data/useTags'
import MenuCategoryList from '~/components/catalog/CategoryTabs.vue'
import MenuDishList from '~/components/menu/DishList.vue'
import MenuComboList from '~/components/menu/ComboList.vue'
import MenuVirtualDishList from '~/components/menu/VirtualDishList.vue'

const { tenantId } = storeToRefs(useTenantStore())

const selectedCategoryId = ref<string | null>(null)

const { categories, loading: categoriesLoading } = useCategories(tenantId)
const { tags } = useTags(tenantId)
const { counts: dishCounts, refresh: refreshDishCounts } = useDishCounts(tenantId, categories)

const selectedCategory = computed(() => categories.value.find((c) => c.id === selectedCategoryId.value) ?? null)

watchEffect(() => {
  if (!selectedCategoryId.value && categories.value.length > 0) {
    selectedCategoryId.value = categories.value[0].id
  }
})

watch(categories, () => {
  refreshDishCounts()
})
</script>
