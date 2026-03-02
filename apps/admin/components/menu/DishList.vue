<template>
  <main class="dishes-root">
    <div v-if="!categoryId" class="no-category">
      <span>← Выберите категорию</span>
    </div>

    <template v-else>
      <div class="panel-header">
        <span class="panel-title">
          {{ categoryName }}
          <span class="dish-count">({{ dishes.length }})</span>
        </span>
        <UiButton size="small" type="tertiary" @click="openDishModal(null)">+ Добавить блюдо</UiButton>
      </div>

      <div class="grid-wrap">
        <UiSkeleton v-if="dishesLoading" text :repeat="6" />

        <template v-else-if="dishes.length === 0">
          <p class="dish-empty">В этой категории пока нет блюд</p>
        </template>

        <UiGrid
          v-else
          :items="dishes"
          key-field="id"
          :columns="{ s: 2, m: 2, l: 3 }"
          :gap="10"
          no-animation
        >
          <template #default="{ item: dish }">
            <UiCard size="tiny" class="dish-card" :class="{ inactive: !dish.active }">
              <UiSpace :size="8" vertical>
                <div class="card-photo">
                  <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" />
                  <span v-else class="photo-placeholder">🍽</span>
                </div>

                <span class="dish-name">{{ dish.name }}</span>

                <UiSpace :size="4" align="center">
                  <span class="dish-price">{{ formatPrice(dish.price) }}</span>
                  <UiTag v-for="tag in dish.tags" :key="tag" size="tiny">{{ tagLabel[tag] }}</UiTag>
                </UiSpace>

                <div class="card-actions">
                  <UiAppToggle
                    :model-value="dish.active"
                    @update:model-value="toggleActive(dish.id, $event)"
                  />
                  <div class="card-btns">
                    <button class="icon-btn" title="Редактировать" @click="openDishModal(dish)">
                      <UiIcon name="pencil" :size="16" />
                    </button>
                    <button class="icon-btn" title="Удалить" @click="confirmDeleteDish(dish.id)">
                      <UiIcon name="trash" :size="16" />
                    </button>
                  </div>
                </div>
              </UiSpace>
            </UiCard>
          </template>
        </UiGrid>
      </div>
    </template>

    <MenuDishFormModal
      v-if="categoryId"
      v-model="dishModalOpen"
      :tenant-id="tenantId"
      :category-id="categoryId"
      :dish="editingDish"
      @saved="dishModalOpen = false"
    />
  </main>
</template>

<script setup lang="ts">
import { UiButton, UiIcon, UiSkeleton, UiSpace, UiTag, UiCard, UiGrid, useConfirm } from '@fastfood-saas/ui'
import type { Dish } from '@fastfood-saas/shared'

const props = defineProps<{
  tenantId: string
  categoryId: string | null
  categoryName: string
}>()

const tenantIdRef = computed(() => props.tenantId)
const categoryIdRef = computed(() => props.categoryId)

const { dishes, loading: dishesLoading, remove: removeDish, toggleActive } =
  useDishes(tenantIdRef, categoryIdRef)

const { confirm } = useConfirm()

const priceFormatter = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const formatPrice = (price: number) => priceFormatter.format(price)

const tagLabel: Record<string, string> = {
  spicy: '🌶 Острое',
  vegetarian: '🥦 Вегет.',
  vegan: '🌱 Веган',
  new: '🆕 Новинка',
  popular: '⭐ Популярное',
  hit: '🔥 Хит',
}

const dishModalOpen = ref(false)
const editingDish = ref<Dish | null>(null)

function openDishModal(dish: Dish | null) {
  editingDish.value = dish
  dishModalOpen.value = true
}

async function confirmDeleteDish(id: string) {
  const ok = await confirm({
    title: 'Удалить блюдо?',
    confirmText: 'Удалить',
    confirmType: 'error',
  })
  if (ok) await removeDish(id)
}
</script>

<style scoped lang="scss">
.dishes-root {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.panel-title {
  font-size: 15px;
  font-weight: 700;
  color: #111;
}

.dish-count {
  font-weight: 400;
  color: #999;
  font-size: 13px;
}

.no-category {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
  font-size: 15px;
}

.grid-wrap {
  overflow-y: auto;
  flex: 1;
  padding: 12px;
}

.dish-card {
  &.inactive {
    opacity: 0.5;
  }
}

.card-photo {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.photo-placeholder {
  font-size: 28px;
}

.dish-name {
  font-size: 13px;
  font-weight: 600;
  color: #111;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.dish-price {
  font-size: 13px;
  font-weight: 700;
  color: #ff6b35;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-btns {
  display: flex;
  gap: 2px;
}

.icon-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #bbb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #f0f0f0;
    color: #333;
  }
}

.dish-empty {
  padding: 24px;
  text-align: center;
  color: #bbb;
  font-size: 13px;
}
</style>
