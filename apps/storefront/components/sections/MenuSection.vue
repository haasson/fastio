<template>
  <SfSection class="menu-root">
    <!-- Режим: список блюд по категориям -->
    <template v-if="defaultView === 'dishes'">
      <div v-if="categories.length" class="menu-content">
        <div
          v-for="category in categories"
          :id="`category-${category.id}`"
          :key="category.id"
          class="category-block"
        >
          <SfHeading as="h3" class="category-title">{{ category.name }}</SfHeading>
          <div class="menu-grid">
            <template v-if="category.type === 'combo'">
              <SfDishCard
                v-for="combo in combosByCategory[category.id] ?? []"
                :key="combo.id"
                :dish="combo"
                :combo-id="combo.id"
                @add="addComboToCart(combo)"
              />
            </template>
            <template v-else>
              <SfDishCard
                v-for="dish in dishesByCategory[category.id] ?? []"
                :key="dish.id"
                :dish="dish"
                @add="addToCart(dish)"
              />
            </template>
          </div>
        </div>
      </div>
      <SfEmptyState v-else title="Меню пока пусто" description="Блюда появятся здесь после добавления в меню">
        <UtensilsCrossed :size="48" />
      </SfEmptyState>
    </template>

    <!-- Режим: карточки категорий → провал внутрь -->
    <template v-else>
      <!-- Список категорий -->
      <div v-if="!selectedCategoryId">
        <div v-if="categories.length" class="menu-content">
          <div class="categories-grid">
            <SfCard
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
              <SfText as="span" variant="body-sm" class="category-name">{{ category.name }}</SfText>
            </SfCard>
          </div>
        </div>
        <SfEmptyState v-else title="Меню пока пусто" description="Блюда появятся здесь после добавления в меню">
          <UtensilsCrossed :size="48" />
        </SfEmptyState>
      </div>

      <!-- Блюда выбранной категории -->
      <div v-else>
        <button class="back-btn" @click="selectedCategoryId = null">
          <ChevronLeft :size="18" />
          {{ selectedCategory?.name }}
        </button>
        <div class="menu-content">
          <div class="menu-grid">
            <template v-if="selectedCategory?.type === 'combo'">
              <SfDishCard
                v-for="combo in combosByCategory[selectedCategoryId] ?? []"
                :key="combo.id"
                :dish="combo"
                :combo-id="combo.id"
                @add="addComboToCart(combo)"
              />
            </template>
            <template v-else>
              <SfDishCard
                v-for="dish in dishesByCategory[selectedCategoryId] ?? []"
                :key="dish.id"
                :dish="dish"
                @add="addToCart(dish)"
              />
            </template>
          </div>
        </div>
      </div>
    </template>
  </SfSection>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { UtensilsCrossed, ChevronLeft } from 'lucide-vue-next'
import type { Dish, Combo } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import { useMenuStore } from '~/stores/menu'
import SfSection from '~/components/sf/layout/SfSection.vue'
import SfCard from '~/components/sf/layout/SfCard.vue'
import SfHeading from '~/components/sf/typography/SfHeading.vue'
import SfText from '~/components/sf/typography/SfText.vue'
import SfDishCard from '~/components/sf/domain/SfDishCard.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'

defineProps<{
  defaultView: 'categories' | 'dishes'
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

const categoryPhotos = computed<Record<string, string | null>>(() =>
  categories.value.reduce((acc, cat) => {
    acc[cat.id] = cat.photoUrl
      ?? (cat.useFirstDishPhoto ? dishesByCategory.value[cat.id]?.[0]?.photos[0] ?? null : null)
    return acc
  }, {} as Record<string, string | null>)
)

function addToCart(dish: Dish) {
  cart.add({
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
  })
}

function addComboToCart(combo: Combo) {
  cart.add({
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
  })
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
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
