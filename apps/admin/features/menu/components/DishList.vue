<template>
  <main class="dishes-root">
    <UiEmpty
      v-if="!categoryId"
      icon="dishes"
      text="Выберите категорию"
    />

    <template v-else>
      <UiSectionHeader :title="item.plural.label">
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
              <UiEmpty v-if="dishes.length === 0" icon="dishes" :text="`В этой категории пока нет ${item.plural.gen}`" />

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
      :add-dish="rawAddDish"
      :update-dish="rawUpdateDish"
      @saved="onDishSaved"
    />
  </main>
</template>

<script setup lang="ts">
import { toRefs, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useTerms } from '~/composables/useTerms'
import {
  UiButton, UiDataTable, UiDivider, UiEmpty, UiInput,
  UiSectionHeader, UiSegmentedControl, UiSkeleton,
} from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Dish, Category, DishTagDefinition } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import MenuItemCard from '~/components/catalog/ItemCard.vue'
import MenuDishFormDrawer from './DishFormDrawer.vue'
import { useDishes } from '../composables/useDishes'
import { useDishTable } from '../composables/useDishTable'
import { useItemManager } from '~/composables/ui/useItemManager'
import { useTagDisplay } from '~/composables/ui/useTagDisplay'
import { useDatabase } from '~/composables/data/useDatabase'

const props = defineProps<{
  tenantId: string
  categoryId: string | null
  categories: Category[]
  tags: DishTagDefinition[]
}>()

const emit = defineEmits<{
  dishesChanged: []
}>()

const { item } = useTerms()

const { tenantId: tenantIdRef, categoryId: categoryIdRef } = toRefs(props)

const api = useDatabase()
const { confirm } = useConfirm()

const { dishes, loading: dishesLoading, add: rawAddDish, update: rawUpdateDish, remove: rawRemoveDish, toggleActive: rawToggleActive, reorder }
  = useDishes(tenantIdRef, categoryIdRef)

const getComboWarning = async (dishId: string): Promise<string | undefined> => {
  const names = await api.combos.getActiveComboNamesByDishId(dishId)

  if (names.length === 0) return undefined

  return `Блюдо входит в комбо: ${names.join(', ')}. Они перестанут отображаться в меню.`
}

const toggleActive = async (id: string, active: boolean) => {
  if (!active) {
    const alert = await getComboWarning(id)

    if (alert) {
      const ok = await confirm({ title: `Отключить ${item.acc}?`, alert, confirmText: 'Отключить', confirmType: 'warning' })

      if (!ok) return
    }
  }
  await rawToggleActive(id, active)
}

const removeDish = async (...args: Parameters<typeof rawRemoveDish>) => {
  await rawRemoveDish(...args)
  emit('dishesChanged')
}

const onDishSaved = () => {
  closeDishModal()
  emit('dishesChanged')
}

const VIEW_ITEMS = [
  { label: 'Карточки', value: 'cards' },
  { label: 'Таблица', value: 'table' },
  { label: 'Порядок', value: 'order' },
]

const dishView = useLocalStorage<'cards' | 'table' | 'order'>('menu:dish-view', 'cards')

const { showSkeleton, modalOpen: dishModalOpen, editingItem: editingDish, openModal: openDishModal, closeModal: closeDishModal, confirmDelete: confirmDeleteDish }
  = useItemManager<Dish>({
    loading: dishesLoading,
    remove: removeDish,
    confirmTitle: `Удалить ${item.acc}?`,
    beforeDelete: async (id) => {
      const alert = await getComboWarning(id)

      return alert ? { alert } : undefined
    },
  })

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
  gap: var(--space-12);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.search {
  width: 220px;
}

.content-wrap {
  overflow-y: auto;
  flex: 1;
  padding-top: var(--space-4);
}

.content-inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
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
  gap: var(--space-8);

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
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-primary);
  white-space: nowrap;
}
</style>
