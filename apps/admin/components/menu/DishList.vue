<template>
  <main class="dishes-root">
    <div v-if="!categoryId" class="no-category">
      <span>← Выберите категорию</span>
    </div>

    <template v-else>
      <UiSectionHeader :title="sectionTitle">
        <template #left>
          <div class="header-left">
            <UiSegmentedControl
              v-model="dishView"
              :items="VIEW_ITEMS"
              size="medium"
            />
            <template v-if="dishView === 'table'">
              <UiDivider vertical />
              <UiInput
                v-model:value="searchQuery"
                placeholder="Поиск по названию…"
                clearable
                size="medium"
                class="search"
              />
            </template>
          </div>
        </template>
        <template #right>
          <UiButton
            data-tour="add-dish"
            size="medium"
            type="primary"
            icon="plus"
            @click="openDishModal(null)"
          >Добавить</UiButton>
        </template>
      </UiSectionHeader>

      <div class="content-wrap">
        <Transition name="dishes-fade" mode="out-in">
          <div :key="`${categoryId}-${dishView}`" class="content-inner">
            <UiSkeleton v-if="showSkeleton" text :repeat="6" />

            <template v-else-if="!dishesLoading">
              <UiEmpty v-if="dishes.length === 0" icon="dishes" :text="emptyText" />

              <template v-else>

                <!-- Карточки с DnD -->
                <VueDraggable
                  v-if="dishView === 'cards'"
                  v-model="dishes"
                  class="cards-grid"
                  :animation="180"
                  ghost-class="card-ghost"
                  @end="reorderDishes"
                >
                  <UiCard
                    v-for="dish in dishes"
                    :key="dish.id"
                    size="small"
                    class="dish-card"
                    :class="{ inactive: !dish.active }"
                  >
                    <UiSpace :size="8" vertical>
                      <div class="card-photo">
                        <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" />
                        <UiPhotoPlaceholder v-else size="medium" />
                      </div>
                      <span class="dish-name">{{ dish.name }}</span>
                      <UiSpace :size="4" align="center">
                        <span class="dish-price">{{ formatPrice(dish.price) }}</span>
                        <UiTag
                          v-for="tagId in dish.tags"
                          :key="tagId"
                          size="tiny"
                          empty
                          round
                          :style="tagStyle(tagId)"
                        >{{ tagName(tagId) }}</UiTag>
                      </UiSpace>
                      <div class="card-actions">
                        <UiSwitch
                          :model-value="dish.active"
                          @update:model-value="toggleActive(dish.id, $event)"
                        />
                        <AppActionsBlock
                          @edit="openDishModal(dish)"
                          @delete="confirmDeleteDish(dish.id)"
                        />
                      </div>
                    </UiSpace>
                  </UiCard>
                </VueDraggable>

                <!-- Таблица -->
                <template v-else-if="dishView === 'table'">
                  <UiEmpty
                    v-if="filteredDishes.length === 0"
                    icon="dishes"
                    text="Ничего не найдено"
                  />
                  <UiDataTable
                    v-else
                    :columns="tableColumns"
                    :data="filteredDishes"
                    :row-key="(row: Dish) => row.id"
                    :bordered="false"
                    size="small"
                  />
                </template>

                <!-- Порядок: чистый DnD -->
                <AppDraggableList
                  v-else-if="dishView === 'order'"
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
                    </template>
                  </AppListRow>
                </AppDraggableList>

              </template>
            </template>
          </div>
        </Transition>
      </div>
    </template>

    <MenuDishFormDrawer
      v-if="categoryId"
      v-model="dishModalOpen"
      :tenant-id="tenantId"
      :category-id="categoryId"
      :categories="props.categories"
      :dish="editingDish"
      :tags="props.tags"
      :add-dish="addDish"
      :update-dish="updateDish"
      @saved="closeDishModal"
    />
  </main>
</template>

<script setup lang="ts">
import { toRefs, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useTenantLabels } from '~/composables/plan/useTenantLabels'
import { VueDraggable } from 'vue-draggable-plus'
import {
  UiButton, UiCard, UiDataTable, UiDivider, UiEmpty, UiInput,
  UiPhotoPlaceholder, UiSectionHeader, UiSegmentedControl, UiSkeleton,
  UiSpace, UiSwitch, UiTag,
} from '@fastio/ui'
import type { Dish, Category, DishTagDefinition } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import MenuDishFormDrawer from '~/components/menu/DishFormDrawer.vue'
import { useDishes } from '~/composables/data/useDishes'
import { useDishTable } from '~/composables/ui/useDishTable'
import { useItemManager } from '~/composables/ui/useItemManager'
import { useTagDisplay } from '~/composables/ui/useTagDisplay'

const props = defineProps<{
  tenantId: string
  categoryId: string | null
  categories: Category[]
  tags: DishTagDefinition[]
}>()

const emit = defineEmits<{
  dishesChanged: []
}>()

const { isServices, itemsLabel, itemsLabelLower, itemsLabelGen } = useTenantLabels()
const sectionTitle = computed(() => isServices.value ? 'Услуги' : 'Блюда')
const emptyText = computed(() => `В этой категории пока нет ${itemsLabelGen.value}`)

const { tenantId: tenantIdRef, categoryId: categoryIdRef } = toRefs(props)

const { dishes, loading: dishesLoading, add: rawAddDish, update: rawUpdateDish, remove: rawRemoveDish, toggleActive, reorder }
  = useDishes(tenantIdRef, categoryIdRef)

const addDish = async (...args: Parameters<typeof rawAddDish>) => {
  const dish = await rawAddDish(...args)

  emit('dishesChanged')

  return dish
}

const updateDish = async (...args: Parameters<typeof rawUpdateDish>) => {
  await rawUpdateDish(...args)
  emit('dishesChanged')
}

const removeDish = async (...args: Parameters<typeof rawRemoveDish>) => {
  await rawRemoveDish(...args)
  emit('dishesChanged')
}

const VIEW_ITEMS = [
  { label: 'Карточки', value: 'cards' },
  { label: 'Таблица', value: 'table' },
  { label: 'Порядок', value: 'order' },
]

const dishView = useLocalStorage<'cards' | 'table' | 'order'>('menu:dish-view', 'cards')

const { showSkeleton, modalOpen: dishModalOpen, editingItem: editingDish, openModal: openDishModal, closeModal: closeDishModal, confirmDelete: confirmDeleteDish }
  = useItemManager<Dish>({ loading: dishesLoading, remove: removeDish, confirmTitle: `Удалить ${itemsLabelLower.value}?` })

const reorderDishes = () => reorder(dishes.value)

const { searchQuery, filteredDishes, tableColumns } = useDishTable(dishes, {
  onEdit: openDishModal,
  onDelete: confirmDeleteDish,
  onToggleActive: toggleActive,
  tags: computed(() => props.tags),
})

const { tagName, tagStyle } = useTagDisplay(computed(() => props.tags))
</script>

<style scoped lang="scss">
.dishes-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 12px;
}

.no-category {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  font-size: 15px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.search {
  width: 220px;
}

.content-wrap {
  overflow-y: auto;
  flex: 1;
  padding-top: 2px;
}

.content-inner {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dishes-fade-enter-active,
.dishes-fade-leave-active {
  transition: opacity 0.15s;
}

.dishes-fade-enter-from,
.dishes-fade-leave-to {
  opacity: 0;
}

// Карточки
.card-ghost {
  opacity: 0.35;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 1200px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.dish-card {
  cursor: grab;

  &:active { cursor: grabbing; }
  &.inactive { opacity: 0.5; }
}

.card-photo {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
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

.dish-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dish-price {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

// Порядок
.order-price {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}
</style>
