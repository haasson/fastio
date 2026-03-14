<template>
  <main class="dishes-root">
    <div v-if="!categoryId" class="no-category">
      <span>← Выберите категорию</span>
    </div>

    <template v-else>
      <UiSectionHeader title="Блюда">
        <template #left>
          <UiSegmentedControl
            v-model="dishView"
            :items="[{ label: 'Карточки', value: 'cards' }, { label: 'Список', value: 'list' }]"
            size="medium"
          />
        </template>
        <template #right>
          <UiButton
            size="medium"
            type="primary"
            icon="plus"
            @click="openDishModal(null)"
          >Добавить</UiButton>
        </template>
      </UiSectionHeader>

      <div class="grid-wrap">
        <Transition name="dishes-fade" mode="out-in">
          <div :key="categoryId ?? ''" class="grid-inner">
            <UiSkeleton v-if="showSkeleton" text :repeat="6" />

            <template v-else-if="!dishesLoading">
              <UiEmpty v-if="dishes.length === 0" icon="dishes" text="В этой категории пока нет блюд" />

              <template v-else>
                <!-- Вид карточек -->
                <VueDraggable
                  v-show="dishView === 'cards'"
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
                        <UiTag v-for="tag in dish.tags" :key="tag" size="tiny">{{ tagOptions[tag] }}</UiTag>
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

                <!-- Вид списка -->
                <VueDraggable
                  v-show="dishView === 'list'"
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
                    <div class="list-tags">
                      <UiTag v-for="tag in dish.tags" :key="tag" size="tiny">{{ tagOptions[tag] }}</UiTag>
                    </div>
                    <span class="list-price">{{ formatPrice(dish.price) }}</span>
                    <div class="list-actions">
                      <UiSwitch
                        :model-value="dish.active"
                        @update:model-value="toggleActive(dish.id, $event)"
                      />
                      <AppActionsBlock
                        @edit="openDishModal(dish)"
                        @delete="confirmDeleteDish(dish.id)"
                      />
                    </div>
                  </div>
                </VueDraggable>
              </template>
            </template>
          </div>
        </Transition>
      </div>
    </template>

    <MenuDishFormModal
      v-if="categoryId"
      v-model="dishModalOpen"
      :tenant-id="tenantId"
      :category-id="categoryId"
      :categories="props.categories"
      :dish="editingDish"
      :add-dish="addDish"
      :update-dish="updateDish"
      @saved="closeDishModal"
    />
  </main>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { VueDraggable } from 'vue-draggable-plus'
import { UiButton, UiSkeleton, UiSpace, UiTag, UiCard, UiIcon, UiSwitch, UiSegmentedControl, UiPhotoPlaceholder, UiSectionHeader, UiEmpty } from '@fastio/ui'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import type { Dish, Category } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import MenuDishFormModal from '~/components/menu/DishFormModal.vue'
import { useDishes } from '~/composables/data/useDishes'
import { useItemManager } from '~/composables/ui/useItemManager'
import { tagOptions } from '~/config/dish-tags'

const props = defineProps<{
  tenantId: string
  categoryId: string | null
  categories: Category[]
}>()

const emit = defineEmits<{
  dishesChanged: []
}>()

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

const dishView = useLocalStorage<'cards' | 'list'>('menu:dish-view', 'cards')

const { showSkeleton, modalOpen: dishModalOpen, editingItem: editingDish, openModal: openDishModal, closeModal: closeDishModal, confirmDelete: confirmDeleteDish }
  = useItemManager<Dish>({ loading: dishesLoading, remove: removeDish, confirmTitle: 'Удалить блюдо?' })

const reorderDishes = () => reorder(dishes.value)
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.grid-wrap {
  overflow-y: auto;
  flex: 1;
  padding-top: 2px;
}

.grid-inner {
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

// Cards view
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

  &:active {
    cursor: grabbing;
  }

  &.inactive {
    opacity: 0.5;
  }
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

// List view
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

.list-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
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
  gap: 10px;
}
</style>
