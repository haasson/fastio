<template>
  <div class="menu-root">
    <div v-if="!tenantStore.tenant && !tenantStore.loading" class="empty-state">
      <p>Заведение не найдено. Обратитесь в поддержку.</p>
    </div>

    <div v-else-if="tenantStore.tenant" class="layout">
      <MenuCategoryList
        v-model="selectedCategoryId"
        :tenant-id="tenantId"
        @categories-loaded="onCategoriesLoaded"
      />
      <MenuDishList
        :tenant-id="tenantId"
        :category-id="selectedCategoryId"
        :category-name="selectedCategoryName"
      />
    </div>
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
const categoriesCache = ref<Category[]>([])

const onCategoriesLoaded = (cats: Category[]) => {
  categoriesCache.value = cats
  if (!selectedCategoryId.value && cats.length > 0) {
    selectedCategoryId.value = cats[0].id
  }
}

const selectedCategoryName = computed(
  () => categoriesCache.value.find((c) => c.id === selectedCategoryId.value)?.name ?? '',
)
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/media-queries' as *;

.menu-root {
  height: 100%;
}

.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  height: auto;

  @include mq-m {
    grid-template-columns: 260px 1fr;
    height: calc(100vh - 60px - 48px);
  }
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--color-text-secondary);
}
</style>
