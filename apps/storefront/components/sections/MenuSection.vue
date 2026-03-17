<template>
  <SfSection class="menu-root">
    <template v-if="categories.length">
      <div
        v-for="category in categories"
        :id="`category-${category.id}`"
        :key="category.id"
        class="category-block"
      >
        <SfHeading as="h3" class="category-title">{{ category.name }}</SfHeading>
        <div class="menu-grid">
          <SfDishCard
            v-for="dish in dishesByCategory[category.id] ?? []"
            :key="dish.id"
            :dish="dish"
            @add="addToCart(dish)"
          />
        </div>
      </div>
    </template>

    <SfEmptyState
      v-else
      title="Меню пока пусто"
      description="Блюда появятся здесь после добавления в меню"
    >
      <UtensilsCrossed :size="48" />
    </SfEmptyState>
  </SfSection>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import { UtensilsCrossed } from 'lucide-vue-next'
import type { Dish, Category } from '@fastio/shared'
import type { DishModifierGroup } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'
import SfSection from '~/components/sf/layout/SfSection.vue'
import SfHeading from '~/components/sf/typography/SfHeading.vue'
import SfDishCard from '~/components/sf/domain/SfDishCard.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'

defineProps<{
  defaultView: 'categories' | 'dishes'
}>()

type MenuData = {
  categories: Category[]
  dishes: Dish[]
  dishModifiers: Record<string, DishModifierGroup[]>
}

const { data: menu } = useNuxtData<MenuData>('menu')
const cart = useCartStore()

const dishesByCategory = computed<Record<string, Dish[]>>(() => {
  const dishes = menu.value?.dishes ?? []
  return dishes.reduce<Record<string, Dish[]>>((acc, dish) => {
    if (!acc[dish.categoryId]) acc[dish.categoryId] = []
    acc[dish.categoryId].push(dish)
    return acc
  }, {})
})

const categories = computed<Category[]>(() =>
  (menu.value?.categories ?? []).filter(c => (dishesByCategory.value[c.id]?.length ?? 0) > 0)
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
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.menu-root {
  padding-block: 64px;

  @include lg {
    padding-block: 96px;
  }
}

.menu-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

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
</style>
