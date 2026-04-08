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
            <template #append>
              <span class="order-price">{{ formatPrice(dish.price) }}</span>
              <AppActionsBlock :show-delete="false" @edit="openDishModal(dish)" />
            </template>
          </AppListRow>
        </AppDraggableList>
      </template>
    </div>

    <MenuDishFormDrawer
      v-if="editingDish"
      v-model="dishModalOpen"
      :tenant-id="tenantId"
      :category-id="editingDish.categoryId"
      :categories="categories"
      :dish="editingDish"
      :tags="allTags"
      :update-dish="updateDish"
      @saved="closeDishModal"
    />
  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiSkeleton, UiAlert, UiSectionHeader, UiEmpty } from '@fastio/ui'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import type { Dish, Category, DishTagDefinition } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import MenuDishFormDrawer from '~/components/menu/DishFormDrawer.vue'
import { useDatabase } from '~/composables/data/useDatabase'
import type { DishFormData } from '~/utils/api/dishes'

const props = defineProps<{
  tenantId: string
  tagId: string
  categoryName: string
  categories: Category[]
  allTags: DishTagDefinition[]
}>()

const tagName = computed(() => props.allTags.find((t) => t.id === props.tagId)?.name ?? '')

const api = useDatabase()
const loading = ref(false)
const dishes = ref<Dish[]>([])

const loadDishes = async () => {
  if (!props.tenantId || !props.tagId) return
  loading.value = true

  const dishIds = await api.tags.listDishIdsByTag(props.tenantId, props.tagId)

  if (dishIds.length === 0) {
    dishes.value = []
    loading.value = false

    return
  }

  const allActive = await api.dishes.listAllActive(props.tenantId)
  const dishMap = new Map(allActive.map((d) => [d.id, d]))

  dishes.value = dishIds.map((id) => dishMap.get(id)).filter(Boolean) as Dish[]
  loading.value = false
}

watch([() => props.tenantId, () => props.tagId], () => {
  if (props.tenantId && props.tagId) loadDishes()
}, { immediate: true })

const dishModalOpen = ref(false)
const editingDish = ref<Dish | null>(null)

const openDishModal = (dish: Dish) => {
  editingDish.value = dish
  dishModalOpen.value = true
}

const reorderDishes = async () => {
  await api.tags.reorderByTag(props.tenantId, props.tagId, dishes.value.map((d, i) => ({ id: d.id, order: i })))
}

const closeDishModal = () => {
  dishModalOpen.value = false
  loadDishes()
}

const updateDish = async (id: string, data: Partial<DishFormData>) => {
  await api.dishes.update(id, data)
}
</script>

<style scoped lang="scss">
.virtual-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 12px;
}

.hint-banner {
  flex-shrink: 0;
}

.list-wrap {
  overflow-y: auto;
  flex: 1;
  padding-top: 2px;
}

.order-price {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}
</style>
