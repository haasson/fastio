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
              <SfDishCard
                v-for="combo in combosByCategory[category.id] ?? []"
                :key="combo.id"
                :dish="combo"
                :combo-id="combo.id"
                :hide-stepper="tableMode"
                :is-services="servicesMode"
                :ordering-enabled="effectiveOrderingEnabled"
                :overlay="props.dishDescriptionMode === 'overlay'"
                :mobile-compact="props.mobileDishCard === 'horizontal'"
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
                :is-services="servicesMode"
                :ordering-enabled="effectiveOrderingEnabled"
                :overlay="props.dishDescriptionMode === 'overlay'"
                :mobile-compact="props.mobileDishCard === 'horizontal'"
                @add="handleAddButton(dish)"
                @card-click="handleCardClick(dish)"
                @request="openRequestModal(dish)"
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

    <ServiceRequestModal
      v-if="requestDish"
      v-model="requestModalOpen"
      :dish="requestDish"
    />
  </FsSection>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Dish, Combo, Tenant, Category } from '@fastio/shared'
import { isAutoCategory } from '@fastio/shared'
import { useNuxtData, useRouter } from 'nuxt/app'
import { useItemPlaceholder } from '~/composables/useItemPlaceholder'
import { useStorefrontTerms } from '~/composables/useStorefrontTerms'
import { useCartStore, type CartItem } from '~/stores/cart'
import { useMenuStore, type ClientAddon } from '~/stores/menu'
import type { ModalItem } from '~/composables/useDishCustomization'
import useLegalCompliance from '~/composables/useLegalCompliance'
import { FsSection, FsCard, FsHeading, FsText } from '@fastio/public-ui'
import SfDishCard from '~/components/sf/domain/SfDishCard.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import DishModal from '~/components/sf/domain/DishModal.vue'
import ServiceRequestModal from '~/components/services/ServiceRequestModal.vue'

const props = defineProps<{
  defaultView: 'categories' | 'dishes'
  categoryId?: string | null
  tableMode?: boolean
  dishDescriptionMode?: 'below' | 'overlay'
  mobileDishCard?: 'vertical' | 'horizontal'
}>()

const emit = defineEmits<{
  tableOrder: [item: CartItem]
}>()

const { placeholderIcon } = useItemPlaceholder()
const { menu } = useStorefrontTerms()
const menuStore = useMenuStore()
const cart = useCartStore()
const router = useRouter()
const { data: tenant } = useNuxtData<Tenant>('tenant')
// «Услуга» как режим взаимодействия (форма записи вместо корзины) — это услуги-тенант
// с активным модулем `services`. Если модуль выключен (например, тариф без него) —
// рендерим как обычный каталог с режимом «только просмотр».
const servicesMode = computed(() => tenant.value?.businessType === 'services' && !!tenant.value?.modules?.services)
const { legalInfoComplete } = useLegalCompliance()
const orderingEnabled = computed(() => !!tenant.value?.orderingEnabled)
const effectiveOrderingEnabled = computed(() => orderingEnabled.value && legalInfoComplete.value)
const viewOnly = computed(() => !effectiveOrderingEnabled.value && !props.tableMode && !servicesMode.value)

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

// Service request modal
type ServiceDish = { id: string; name: string; price: number; categoryName: string | null }
const requestModalOpen = ref(false)
const requestDish = ref<ServiceDish | null>(null)

function openRequestModal(dish: Dish) {
  requestDish.value = { id: dish.id, name: dish.name, price: dish.price, categoryName: findCategoryName(dish.id) }
  requestModalOpen.value = true
}

function hasModifiers(dish: Dish): boolean {
  return (menuStore.dishModifiers[dish.id]?.length ?? 0) > 0
}

function openModal(item: ModalItem) {
  modalItem.value = item
  modalOpen.value = true
}

function findCategoryName(dishOrComboId: string): string | null {
  for (const cat of categories.value) {
    if (isAutoCategory(cat)) continue
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
    addToCart(dish)
  }
}

function handleCardClick(dish: Dish) {
  if (servicesMode.value) {
    openRequestModal(dish)
  } else {
    openDishModal(dish)
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

function addToCart(dish: Dish) {
  const item: CartItem = {
    dishId: dish.id,
    comboId: null,
    dishName: dish.name,
    categoryName: findCategoryName(dish.id),
    price: dish.price,
    quantity: 1,
    modifiers: [],
    removedIngredients: [],
    addons: [],
    photo: dish.photos[0] ?? null,
    completedAt: null,
    comboItems: null,
    addedBy: null,
    confirmedBy: null,
    status: 'confirmed',
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
    categoryName: findCategoryName(combo.id),
    price: combo.price,
    quantity: 1,
    modifiers: [],
    removedIngredients: [],
    addons: [],
    photo: combo.photos[0] ?? null,
    completedAt: null,
    comboItems: null,
    addedBy: null,
    confirmedBy: null,
    status: 'confirmed',
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
