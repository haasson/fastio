<template>
  <div class="menu-root">
    <div v-if="!tenantStore.tenant && !tenantStore.loading" class="empty-state">
      <p>Заведение не найдено. Обратитесь в поддержку.</p>
    </div>

    <template v-else-if="tenantStore.tenant">
      <MenuCategoryList
        v-model="selectedCategoryId"
        :tenant-id="tenantId"
        @categories-loaded="onCategoriesLoaded"
      />
      <MenuDishList
        :tenant-id="tenantId"
        :category-id="selectedCategoryId"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { definePageMeta } from '#imports'
import type { Category } from '@fastio/shared'
import MenuCategoryList from '~/components/menu/CategoryList.vue'
import MenuDishList from '~/components/menu/DishList.vue'
import { useTenantStore } from '~/stores/tenant'

definePageMeta({ middleware: 'auth' })

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const selectedCategoryId = ref<string | null>(null)

const onCategoriesLoaded = (cats: Category[]) => {
  if (!selectedCategoryId.value && cats.length > 0) {
    selectedCategoryId.value = cats[0].id
  }
}
</script>

<style scoped lang="scss">
.menu-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--color-text-secondary);
}
</style>
