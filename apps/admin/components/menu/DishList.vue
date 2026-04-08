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

                <!-- Карточки -->
                <div
                  v-if="dishView === 'cards'"
                  class="cards-grid"
                >
                  <MenuItemCard
                    v-for="dish in dishes"
                    :key="dish.id"
                    :photo="dish.photos[0]"
                    :name="dish.name"
                    :price="dish.price"
                    :tags="dish.tags"
                    :active="dish.active"
                    :tag-name="tagName"
                    :tag-style="tagStyle"
                    @click="openDishModal(dish)"
                    @toggle-active="toggleActive(dish.id, $event)"
                    @delete="confirmDeleteDish(dish.id)"
                  />
                </div>

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
import {
  UiButton, UiDataTable, UiDivider, UiEmpty, UiInput,
  UiSectionHeader, UiSegmentedControl, UiSkeleton,
} from '@fastio/ui'
import type { Dish, Category, DishTagDefinition } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import MenuItemCard from '~/components/menu/ItemCard.vue'
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

// Порядок
.order-price {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-primary);
  white-space: nowrap;
}
</style>
