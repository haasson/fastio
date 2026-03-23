<template>
  <FsSection class="menu-root">
    <!-- Режим categories: сетка карточек категорий -->
    <template v-if="defaultView === 'categories' && !selectedCategoryId">
      <div v-if="categories.length" class="menu-content">
        <div class="categories-grid">
          <FsCard
            v-for="category in categories"
            :key="category.id"
            as="button"
            :image="categoryPhotos[category.id] ?? undefined"
            :image-alt="category.name"
            @click="selectedCategoryId = category.id"
          >
            <template v-if="!categoryPhotos[category.id]" #image>
              <div class="category-placeholder">
                <UtensilsCrossed :size="32" />
              </div>
            </template>
            <FsText as="span" variant="body-sm" class="category-name">{{ category.name }}</FsText>
          </FsCard>
        </div>
      </div>
      <SfEmptyState v-else title="Меню пока пусто" description="Блюда появятся здесь после добавления в меню">
        <UtensilsCrossed :size="48" />
      </SfEmptyState>
    </template>

    <!-- Список блюд (общий для обоих режимов) -->
    <template v-else>
      <button v-if="selectedCategoryId" class="back-btn" @click="selectedCategoryId = null">
        <ChevronLeft :size="18" />
        {{ selectedCategory?.name }}
      </button>

      <div v-if="displayCategories.length" class="menu-content">
        <div
          v-for="category in displayCategories"
          :id="`category-${category.id}`"
          :key="category.id"
          class="category-block"
        >
          <FsHeading v-if="!selectedCategoryId" as="h3" class="category-title">{{ category.name }}</FsHeading>
          <div class="menu-grid">
            <template v-if="category.type === 'combo'">
              <SfDishCard
                v-for="combo in combosByCategory[category.id] ?? []"
                :key="combo.id"
                :dish="combo"
                :combo-id="combo.id"
                :hide-stepper="tableMode"
                @add="addComboToCart(combo)"
                @card-click="openComboModal(combo)"
              />
            </template>
            <template v-else>
              <SfDishCard
                v-for="dish in dishesByCategory[category.id] ?? []"
                :key="dish.id"
                :dish="dish"
                :has-modifiers="hasModifiers(dish)"
                :hide-stepper="tableMode"
                @add="handleAddButton(dish)"
                @card-click="handleCardClick(dish)"
              />
            </template>
          </div>
        </div>
      </div>
      <SfEmptyState v-else title="Меню пока пусто" description="Блюда появятся здесь после добавления в меню">
        <UtensilsCrossed :size="48" />
      </SfEmptyState>
    </template>

    <DishModal
      v-if="modalItem"
      v-model="modalOpen"
      :item="modalItem"
      :modifiers="modalModifiers"
      :addons="modalAddons"
      :mode="tableMode ? 'order' : 'add'"
      @add="handleModalAdd"
    />
  </FsSection>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { UtensilsCrossed, ChevronLeft } from 'lucide-vue-next'
import type { Dish, Combo } from '@fastio/shared'
import { useCartStore, type CartItem } from '~/stores/cart'
import { useMenuStore, type ClientAddon } from '~/stores/menu'
import type { ModalItem } from '~/composables/useDishCustomization'
import { FsSection, FsCard, FsHeading, FsText } from '@fastio/public-ui'
import SfDishCard from '~/components/sf/domain/SfDishCard.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import DishModal from '~/components/sf/domain/DishModal.vue'

const props = defineProps<{
  defaultView: 'categories' | 'dishes'
  tableMode?: boolean
}>()

const emit = defineEmits<{
  tableOrder: [item: CartItem]
}>()

const menuStore = useMenuStore()
const cart = useCartStore()
const selectedCategoryId = ref<string | null>(null)

const categories = computed(() => menuStore.visibleCategories)
const dishesByCategory = computed(() => menuStore.dishesByCategory)
const combosByCategory = computed(() => menuStore.combosByCategory)

const selectedCategory = computed(() =>
  categories.value.find(c => c.id === selectedCategoryId.value) ?? null
)

// В режиме dishes — все категории, в режиме categories — только выбранная
const displayCategories = computed(() =>
  selectedCategoryId.value
    ? categories.value.filter(c => c.id === selectedCategoryId.value)
    : categories.value
)

const categoryPhotos = computed<Record<string, string | null>>(() =>
  categories.value.reduce((acc, cat) => {
    acc[cat.id] = cat.photoUrl
      ?? (cat.useFirstDishPhoto ? dishesByCategory.value[cat.id]?.[0]?.photos[0] ?? null : null)
    return acc
  }, {} as Record<string, string | null>)
)

// Modal state
const modalOpen = ref(false)
const modalItem = ref<ModalItem | null>(null)

function hasModifiers(dish: Dish): boolean {
  return (menuStore.dishModifiers[dish.id]?.length ?? 0) > 0
}

function openModal(item: ModalItem) {
  modalItem.value = item
  modalOpen.value = true
}

function findCategoryName(dishOrComboId: string): string | null {
  for (const cat of categories.value) {
    const dishes = dishesByCategory.value[cat.id]
    if (dishes?.some(d => d.id === dishOrComboId)) return cat.name
    const combos = combosByCategory.value[cat.id]
    if (combos?.some(c => c.id === dishOrComboId)) return cat.name
  }
  return null
}

function openDishModal(dish: Dish) {
  openModal({
    id: dish.id,
    name: dish.name,
    description: dish.description,
    price: dish.price,
    photos: dish.photos,
    categoryName: findCategoryName(dish.id),
    ingredients: dish.ingredients,
    nutrition: dish.nutrition,
  })
}

function openComboModal(combo: Combo) {
  openModal({
    id: combo.id,
    name: combo.name,
    description: combo.description,
    price: combo.price,
    photos: combo.photos,
    categoryName: findCategoryName(combo.id),
    comboId: combo.id,
    comboItems: menuStore.comboItems[combo.id] ?? [],
  })
}

function handleAddButton(dish: Dish) {
  if (hasModifiers(dish)) {
    openDishModal(dish)
  } else {
    addToCart(dish)
  }
}

function handleCardClick(dish: Dish) {
  openDishModal(dish)
}

function handleModalAdd(item: CartItem) {
  if (props.tableMode) {
    emit('tableOrder', item)
  } else {
    cart.add(item)
  }
}

const modalModifiers = computed(() =>
  modalItem.value && !modalItem.value.comboId
    ? (menuStore.dishModifiers[modalItem.value.id] ?? [])
    : [],
)

const modalAddons = computed<ClientAddon[]>(() =>
  modalItem.value && !modalItem.value.comboId
    ? (menuStore.dishAddons[modalItem.value.id] ?? [])
    : [],
)

function addToCart(dish: Dish) {
  const item: CartItem = {
    dishId: dish.id,
    comboId: null,
    dishName: dish.name,
    categoryName: null,
    price: dish.price,
    quantity: 1,
    modifiers: [],
    removedIngredients: [],
    addons: [],
    photo: dish.photos[0] ?? null,
  }
  if (props.tableMode) {
    emit('tableOrder', item)
  } else {
    cart.add(item)
  }
}

function addComboToCart(combo: Combo) {
  const item: CartItem = {
    dishId: null,
    comboId: combo.id,
    dishName: combo.name,
    categoryName: null,
    price: combo.price,
    quantity: 1,
    modifiers: [],
    removedIngredients: [],
    addons: [],
    photo: combo.photos[0] ?? null,
  }
  if (props.tableMode) {
    emit('tableOrder', item)
  } else {
    cart.add(item)
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.menu-root {}

.menu-content {
  max-width: 400px;
  margin-inline: auto;

  @include md {
    max-width: none;
  }
}

.menu-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;

  @include md { grid-template-columns: repeat(3, 1fr); gap: 16px; }
  @include lg { grid-template-columns: repeat(4, 1fr); gap: 20px; }
}

.category-block {
  margin-bottom: 32px;

  &:last-child { margin-bottom: 0; }
}

.category-title {
  margin-bottom: 16px;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  @include md { grid-template-columns: repeat(3, 1fr); gap: 16px; }
  @include lg { grid-template-columns: repeat(4, 1fr); gap: 20px; }
}

.category-placeholder {
  width: 100%;
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-border);
  color: var(--color-text-muted);
}

.category-name {
  padding: 10px 12px;
  font-weight: 600;
  line-height: 1.3;
}

// Кнопка назад
.back-btn {
  @include flex-row(4px);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  padding: 0 0 20px;
  transition: color 0.15s;

  &:hover {
    color: var(--primary);
  }
}
</style>
