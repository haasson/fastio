<template>
  <FsSection class="menu-root">
    <!-- Режим categories: сетка карточек категорий -->
    <template v-if="defaultView === 'categories'">
      <div v-if="categories.length" class="menu-content">
        <div class="categories-grid">
          <FsCard
            v-for="category in categories"
            :key="category.id"
            as="button"
            :image="categoryPhotos[category.id] ?? undefined"
            :image-alt="category.name"
            @click="navigateToCategory(category)"
          >
            <template v-if="!categoryPhotos[category.id]" #image>
              <div class="category-placeholder">
                <component :is="placeholderIcon" :size="32" />
              </div>
            </template>
            <FsText as="span" variant="body-sm" class="category-name">{{ category.name }}</FsText>
          </FsCard>
        </div>
      </div>
      <SfEmptyState v-else v-bind="emptyStateProps">
        <component :is="placeholderIcon" :size="48" />
      </SfEmptyState>
    </template>

    <!-- Список блюд -->
    <template v-else>
      <div v-if="displayCategories.length" class="menu-content">
        <div
          v-for="category in displayCategories"
          :id="`category-${category.id}`"
          :key="category.id"
          class="category-block"
        >
          <div class="category-title">
            <FsHeading as="h3">{{ category.name }}</FsHeading>
          </div>
          <div class="menu-grid">
            <template v-if="category.type === 'combo'">
              <SfProductCard
                v-for="combo in combosByCategory[category.id] ?? []"
                :key="combo.id"
                variant="dish"
                :product="productById[combo.id]"
                :cart-count="countFor(combo.id)"
                :ordering-enabled="effectiveOrderingEnabled"
                :overlay="props.dishDescriptionMode === 'overlay'"
                :mobile-compact="props.mobileDishCard === 'horizontal'"
                @add="addItemToCart(combo, 'combo')"
                @increment="incrementByItem(combo.id)"
                @decrement="decrementByItem(combo.id)"
                @card-click="openComboModal(combo)"
              />
            </template>
            <template v-else>
              <SfProductCard
                v-for="dish in dishesByCategory[category.id] ?? []"
                :key="dish.id"
                variant="dish"
                :product="productById[dish.id]"
                :cart-count="countFor(dish.id)"
                :has-modifiers="hasModifiers(dish)"
                :ordering-enabled="effectiveOrderingEnabled"
                :overlay="props.dishDescriptionMode === 'overlay'"
                :mobile-compact="props.mobileDishCard === 'horizontal'"
                @add="handleAddButton(dish)"
                @increment="incrementByItem(dish.id)"
                @decrement="decrementByItem(dish.id)"
                @card-click="openDishModal(dish)"
              />
            </template>
          </div>
        </div>
      </div>
      <SfEmptyState v-else v-bind="emptyStateProps">
        <component :is="placeholderIcon" :size="48" />
      </SfEmptyState>
    </template>

    <DishModal
      v-if="modalItem"
      :key="modalItem.id"
      v-model="modalOpen"
      :item="modalItem"
      :modifiers="modalModifiers"
      :addons="modalAddons"
      :max-addons="modalMaxAddons"
      :view-only="viewOnly"
      :mode="tableMode ? 'order' : 'add'"
      @add="handleModalAdd"
    />
  </FsSection>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Dish, Combo, Tenant, Category } from '@fastio/shared'
import { useNuxtData, useRouter } from 'nuxt/app'
import { useItemPlaceholder } from '~/shared/composables/useItemPlaceholder'
import { useStorefrontTerms } from '~/shared/composables/useStorefrontTerms'
import { useCartStore, isDishItem, type CartItem } from '~/features/cart'
import { useMenuStore, type ClientAddon } from '../stores/menu'
import type { ModalItem } from '../composables/useDishCustomization'
import useLegalCompliance from '~/shared/composables/useLegalCompliance'
import { FsSection, FsCard, FsHeading, FsText } from '@fastio/public-ui'
import SfProductCard from '~/shared/ui/sf/domain/SfProductCard.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'
import DishModal from './DishModal.vue'
import { buildProduct, type ProductData } from '~/shared/utils/product'

const props = defineProps<{
  defaultView: 'categories' | 'dishes'
  categoryId?: string | null
  tableMode?: boolean
  dishDescriptionMode?: 'below' | 'overlay'
  mobileDishCard?: 'vertical' | 'horizontal'
  // table-mode: кол-во в локальном драфте по dishId/comboId — для каунтера на карточке.
  orderCounts?: Record<string, number>
}>()

const emit = defineEmits<{
  tableOrder: [item: CartItem]
  tableInc: [key: string]
  tableDec: [key: string]
}>()

// Счётчик на карточке: в table-mode из драфта, иначе из корзины доставки.
const countFor = (id: string) => props.tableMode
  ? (props.orderCounts?.[id] ?? 0)
  : (cartCountByItem.value[id] ?? 0)

const { placeholderIcon } = useItemPlaceholder()
const { menu } = useStorefrontTerms()
const menuStore = useMenuStore()
const cart = useCartStore()
const router = useRouter()
const { data: tenant } = useNuxtData<Tenant>('tenant')
const { legalInfoComplete } = useLegalCompliance()
const orderingEnabled = computed(() => !!tenant.value?.orderingEnabled)
const effectiveOrderingEnabled = computed(() => orderingEnabled.value && legalInfoComplete.value)
const viewOnly = computed(() => !effectiveOrderingEnabled.value && !props.tableMode)

const emptyStateProps = computed(() => ({
  title: menu.value.emptyTitle,
  description: menu.value.emptyDescription,
}))

const categories = computed(() => menuStore.visibleCategories)
const dishesByCategory = computed(() => menuStore.dishesByCategory)
const combosByCategory = computed(() => menuStore.combosByCategory)

const navigateToCategory = (cat: Category) => {
  router.push(`/category/${cat.slug ?? cat.id}`)
}

const displayCategories = computed(() =>
  props.categoryId
    ? categories.value.filter(c => c.id === props.categoryId)
    : categories.value,
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

const productById = computed<Record<string, ProductData>>(() => {
  const map: Record<string, ProductData> = {}
  const tagDefs = menuStore.tagDefinitions
  for (const cat of categories.value) {
    for (const dish of dishesByCategory.value[cat.id] ?? []) map[dish.id] = buildProduct(dish, tagDefs)
    for (const combo of combosByCategory.value[cat.id] ?? []) map[combo.id] = buildProduct(combo, tagDefs)
  }
  return map
})

// Без модификаторов квантити по dishId/comboId суммируется в один счётчик карточки.
// Если модификаторы есть, dish открывается через openDishModal и каждая комбинация
// модификаторов — отдельная позиция в корзине; стрелки на карточке двигают первую
// найденную из них.
const cartCountByItem = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  for (const i of cart.dishItems) {
    const key = i.comboId ?? i.dishId
    if (!key) continue
    map[key] = (map[key] ?? 0) + i.quantity
  }
  return map
})

const firstIndexByItem = computed<Record<string, number>>(() => {
  const map: Record<string, number> = {}
  cart.items.forEach((i, idx) => {
    if (!isDishItem(i)) return
    const key = i.comboId ?? i.dishId
    if (!key || key in map) return
    map[key] = idx
  })
  return map
})

function incrementByItem(key: string) {
  if (props.tableMode) {
    emit('tableInc', key)

    return
  }
  const idx = firstIndexByItem.value[key]
  if (idx !== undefined) cart.increment(idx)
}

function decrementByItem(key: string) {
  if (props.tableMode) {
    emit('tableDec', key)

    return
  }
  const idx = firstIndexByItem.value[key]
  if (idx !== undefined) cart.decrement(idx)
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
    longDescription: dish.longDescription,
    price: dish.price,
    photos: dish.photos,
    categoryName: findCategoryName(dish.id),
    ingredients: dish.ingredients,
    nutrition: dish.nutrition,
    weightUnit: dish.weightUnit,
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
    addItemToCart(dish, 'dish')
  }
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

const modalMaxAddons = computed(() => {
  if (!modalItem.value) return null
  const dish = menuStore.allDishes.find((d) => d.id === modalItem.value!.id)
  return dish?.maxAddons ?? menuStore.maxAddonsDefault
})

function addItemToCart(input: Dish | Combo, kind: 'dish' | 'combo') {
  const isCombo = kind === 'combo'
  const item: CartItem = {
    kind: 'dish',
    _key: '',
    dishId: isCombo ? null : input.id,
    comboId: isCombo ? input.id : null,
    dishName: input.name,
    categoryName: findCategoryName(input.id),
    price: input.price,
    quantity: 1,
    modifiers: [],
    removedIngredients: [],
    addons: [],
    photo: input.photos[0] ?? null,
    completedAt: null,
    comboItems: null,
    addedBy: null,
    confirmedBy: null,
    status: 'confirmed',
  }
  if (props.tableMode) emit('tableOrder', item)
  else cart.add(item)
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

  @include md { grid-template-columns: repeat(2, 1fr); gap: 16px; }
  @include mdl { grid-template-columns: repeat(3, 1fr); }
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
  aspect-ratio: 1 / 1;
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
</style>
