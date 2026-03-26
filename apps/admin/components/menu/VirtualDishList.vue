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

        <VueDraggable
          v-else
          v-model="dishes"
          class="dish-list"
          handle=".drag-handle"
          :animation="180"
          ghost-class="list-row-ghost"
          @end="reorderDishes"
        >
          <div
            v-for="dish in dishes"
            :key="dish.id"
            class="list-row"
            :class="{ inactive: !dish.active }"
          >
            <UiIcon name="grip" class="drag-handle" />
            <div class="list-photo">
              <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" />
              <UiPhotoPlaceholder v-else size="small" />
            </div>
            <span class="list-name">{{ dish.name }}</span>
            <span class="list-price">{{ formatPrice(dish.price) }}</span>
            <div class="list-actions">
              <AppActionsBlock :show-delete="false" @edit="openDishModal(dish)" />
            </div>
          </div>
        </VueDraggable>
      </template>
    </div>

    <MenuDishFormModal
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
import { VueDraggable } from 'vue-draggable-plus'
import { UiSkeleton, UiIcon, UiPhotoPlaceholder, UiAlert, UiSectionHeader, UiEmpty } from '@fastio/ui'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import type { Dish, Category, DishTagDefinition } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import MenuDishFormModal from '~/components/menu/DishFormModal.vue'
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

.dish-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-row-ghost {
  opacity: 0.35;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);

  &.inactive {
    opacity: 0.5;
  }
}

.drag-handle {
  flex-shrink: 0;
  color: var(--color-text-tertiary);
  cursor: grab;
  width: 16px;
  height: 16px;

  &:active {
    cursor: grabbing;
  }
}

.list-photo {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-page);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.list-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.list-price {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}

.list-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
</style>
