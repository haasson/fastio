<template>
  <main class="virtual-root">
    <UiSectionHeader :title="categoryName">
      <template #right>
        <UiAlert type="info" class="hint-banner">
          Блюда с тегом «{{ tagName }}»
        </UiAlert>
      </template>
    </UiSectionHeader>

    <div class="list-wrap">
      <UiSkeleton v-if="loading" text :repeat="4" />

      <template v-else>
        <UiEmpty v-if="dishes.length === 0" icon="dishes" :text="`Нет блюд с тегом «${tagName}»`" />

        <AppDraggableList
          v-else
          v-model="dishes"
          @reorder="reorderDishes"
        >
          <AppListRow
            v-for="dish in dishes"
            :key="dish.id"
            :name="dish.name"
            :thumb-url="dish.photos[0] ?? null"
            thumb-width="40px"
            thumb-height="40px"
            :disabled="!dish.active"
          >
            <UiText v-if="categoryMap.get(dish.categoryId)" size="small" color="secondary">
              {{ categoryMap.get(dish.categoryId) }}
            </UiText>
            <template #append>
              <span class="order-price">{{ formatPrice(dish.price) }}</span>
            </template>
          </AppListRow>
        </AppDraggableList>
      </template>
    </div>

  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiSkeleton, UiAlert, UiSectionHeader, UiEmpty, UiText } from '@fastio/ui'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import type { Dish, Category, DishTagDefinition } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'

const props = defineProps<{
  tenantId: string
  tagId: string
  categoryName: string
  categories: Category[]
  allTags: DishTagDefinition[]
}>()

const tagName = computed(() => props.allTags.find((t) => t.id === props.tagId)?.name ?? '')
const categoryMap = computed(() => new Map(props.categories.map((c) => [c.id, c.name])))

const api = useDatabase()
const loading = ref(false)
const dishes = ref<Dish[]>([])

const loadDishes = async () => {
  if (!props.tenantId || !props.tagId) return
  loading.value = true

  try {
    const dishIds = await api.tags.listDishIdsByTag(props.tenantId, props.tagId)

    if (dishIds.length === 0) {
      dishes.value = []

      return
    }

    const allActive = await api.dishes.listAllActive(props.tenantId)
    const dishMap = new Map(allActive.map((d) => [d.id, d]))

    dishes.value = dishIds.map((id) => dishMap.get(id)).filter(Boolean) as Dish[]
  } finally {
    loading.value = false
  }
}

watch([() => props.tenantId, () => props.tagId], () => {
  if (props.tenantId && props.tagId) loadDishes()
}, { immediate: true })

const reorderDishes = async () => {
  await api.tags.reorderByTag(props.tenantId, props.tagId, dishes.value.map((d, i) => ({ id: d.id, order: i })))
}

</script>

<style scoped lang="scss">
.virtual-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--space-12);
}

.hint-banner {
  flex-shrink: 0;
}

.list-wrap {
  overflow-y: auto;
  flex: 1;
  padding-top: var(--space-4);
}

.order-price {
  flex-shrink: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  white-space: nowrap;
}
</style>
