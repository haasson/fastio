<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="dish" class="overlay" @mousedown.self="$emit('close')">
        <div class="modal">
          <!-- Фото -->
          <div class="photo">
            <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" />
            <span v-else class="photo-placeholder">🍽</span>
            <button class="close-btn" @click="$emit('close')">✕</button>
          </div>

          <div class="content">
            <!-- Название и теги -->
            <div class="header">
              <h2 class="name">{{ dish.name }}</h2>
              <div v-if="dish.tags.length" class="tags">
                <span v-for="tag in dish.tags" :key="tag" class="tag">{{ tagLabel[tag] }}</span>
              </div>
            </div>

            <p v-if="dish.description" class="description">{{ dish.description }}</p>

            <!-- КБЖУ -->
            <div v-if="dish.nutrition" class="nutrition-grid">
              <div class="nutr-item">
                <span class="nutr-val">{{ dish.nutrition.weight }}г</span>
                <span class="nutr-label">Вес</span>
              </div>
              <div class="nutr-item">
                <span class="nutr-val">{{ dish.nutrition.calories }}</span>
                <span class="nutr-label">Ккал</span>
              </div>
              <div class="nutr-item">
                <span class="nutr-val">{{ dish.nutrition.protein }}г</span>
                <span class="nutr-label">Белки</span>
              </div>
              <div class="nutr-item">
                <span class="nutr-val">{{ dish.nutrition.fat }}г</span>
                <span class="nutr-label">Жиры</span>
              </div>
              <div class="nutr-item">
                <span class="nutr-val">{{ dish.nutrition.carbs }}г</span>
                <span class="nutr-label">Углеводы</span>
              </div>
            </div>

            <!-- Модификаторы -->
            <div v-for="group in modifierGroups" :key="group.groupId" class="modifier-group">
              <p class="modifier-title">{{ group.groupName }}</p>
              <div class="modifier-options">
                <label
                  v-for="opt in group.options"
                  :key="opt.optionId"
                  class="modifier-pill"
                  :class="{ selected: selectedModifiers[group.groupId] === opt.optionId }"
                >
                  <input
                    v-model="selectedModifiers[group.groupId]"
                    type="radio"
                    :name="`mod-${group.groupId}`"
                    :value="opt.optionId"
                    class="modifier-radio"
                  />
                  <span class="pill-label">{{ opt.optionName }}</span>
                  <span class="pill-price">{{ formatOptionPrice(dish!.price, opt.priceDelta) }} ₽</span>
                </label>
              </div>
            </div>

            <!-- Убрать ингредиенты -->
            <div v-if="removableIngredients.length" class="ingredients-section">
              <p class="ingredients-title">Убрать из состава:</p>
              <div class="ingredients-list">
                <label
                  v-for="ing in removableIngredients"
                  :key="ing.name"
                  class="ingredient"
                >
                  <input
                    v-model="removedIngredients"
                    type="checkbox"
                    :value="ing.name"
                    class="ingredient-check"
                  />
                  <span :class="{ removed: removedIngredients.includes(ing.name) }">
                    {{ ing.name }}
                  </span>
                </label>
              </div>
            </div>

            <!-- Количество и кнопка -->
            <div class="add-row">
              <div class="qty-control">
                <button class="qty-btn" @click="qty = Math.max(1, qty - 1)">−</button>
                <span class="qty">{{ qty }}</span>
                <button class="qty-btn" @click="qty++">+</button>
              </div>

              <button class="add-btn" @click="addToCart">
                В корзину · {{ totalPrice * qty }} ₽
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { Dish, DishTag, DishModifierGroup, OrderItemModifier } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'

const props = defineProps<{
  dish: Dish | null
  modifierGroups: DishModifierGroup[]
}>()
const emit = defineEmits<{ close: [] }>()

const cartStore = useCartStore()
const qty = ref(1)
const removedIngredients = ref<string[]>([])
const selectedModifiers = reactive<Record<string, string>>({})

watch(() => props.dish, () => {
  qty.value = 1
  removedIngredients.value = []
  // Reset modifiers to defaults
  Object.keys(selectedModifiers).forEach((k) => delete selectedModifiers[k])
  for (const group of props.modifierGroups) {
    const defaultOpt = group.options.find((o) => o.isDefault) ?? group.options[0]
    if (defaultOpt) selectedModifiers[group.groupId] = defaultOpt.optionId
  }
})

const removableIngredients = computed(() =>
  props.dish?.ingredients.filter((i) => i.removable) ?? [],
)

const modifiersDelta = computed(() => {
  let delta = 0
  for (const group of props.modifierGroups) {
    const selectedId = selectedModifiers[group.groupId]
    const opt = group.options.find((o) => o.optionId === selectedId)
    if (opt) delta += opt.priceDelta
  }
  return delta
})

const totalPrice = computed(() => (props.dish?.price ?? 0) + modifiersDelta.value)

function formatOptionPrice(basePrice: number, priceDelta: number) {
  return basePrice + priceDelta
}

const tagLabel: Record<DishTag, string> = {
  spicy: '🌶 Острое',
  vegetarian: '🥦 Вегетарианское',
  vegan: '🌱 Веганское',
  new: '🆕 Новинка',
  popular: '⭐ Популярное',
  hit: '🔥 Хит продаж',
}

function addToCart() {
  if (!props.dish) return

  const modifiers: OrderItemModifier[] = []
  for (const group of props.modifierGroups) {
    const selectedId = selectedModifiers[group.groupId]
    const opt = group.options.find((o) => o.optionId === selectedId)
    if (opt) {
      modifiers.push({
        groupName: group.groupName,
        optionName: opt.optionName,
        priceDelta: opt.priceDelta,
      })
    }
  }

  cartStore.add({
    dishId: props.dish.id,
    dishName: props.dish.name,
    price: props.dish.price,
    quantity: qty.value,
    removedIngredients: [...removedIngredients.value],
    modifiers: modifiers.length > 0 ? modifiers : undefined,
    photo: props.dish.photos[0] ?? null,
  })
  emit('close')
}
</script>

<style scoped lang="scss">
@use '../../../../packages/ui/src/styles/mixins/media-queries' as *;

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 200;
  padding: 0;

  @include mq-m {
    align-items: center;
    padding: 20px;
  }
}

.modal {
  background: #fff;
  width: 100%;
  max-width: 480px;
  border-radius: 20px 20px 0 0;
  overflow: hidden;
  max-height: 90vh;
  display: flex;
  flex-direction: column;

  @include mq-m {
    border-radius: 20px;
  }
}

.photo {
  position: relative;
  aspect-ratio: 16/9;
  background: #f5f5f5;
  flex-shrink: 0;
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
  font-size: 60px;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  border: none;
  font-size: 13px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name {
  font-size: 20px;
  font-weight: 800;
  color: #111;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tag {
  font-size: 11px;
  font-weight: 600;
  background: var(--primary-light, #fff4f0);
  color: var(--primary);
  padding: 2px 8px;
  border-radius: 6px;
}

.description {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.nutrition-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: #f7f7f8;
  border-radius: 12px;
  padding: 12px;
  gap: 8px;
}

.nutr-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.nutr-val {
  font-size: 14px;
  font-weight: 700;
  color: #111;
}

.nutr-label {
  font-size: 10px;
  color: #aaa;
}

.modifier-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modifier-title {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.modifier-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.modifier-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  background: #f5f5f5;
  padding: 8px 12px;
  border-radius: 10px;
  border: 2px solid transparent;
  transition: border-color 0.12s, background 0.12s;

  &.selected {
    border-color: var(--primary);
    background: var(--primary-light, #fff4f0);
  }
}

.modifier-radio {
  display: none;
}

.pill-label {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.pill-price {
  font-size: 12px;
  font-weight: 700;
  color: #888;
}

.ingredients-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ingredients-title {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.ingredients-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ingredient {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  background: #f5f5f5;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: #444;
  transition: background 0.12s;

  &:has(.ingredient-check:checked) {
    background: #ffeaea;
  }
}

.ingredient-check {
  display: none;
}

.removed {
  text-decoration: line-through;
  color: #bbb;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 4px;
}

.qty-control {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f5f5f5;
  border-radius: 12px;
  padding: 4px 8px;
}

.qty-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background 0.12s;

  &:hover {
    background: #e8e8e8;
  }
}

.qty {
  font-size: 16px;
  font-weight: 700;
  color: #111;
  min-width: 20px;
  text-align: center;
}

.add-btn {
  flex: 1;
  height: 48px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--primary-dark, #e55a25);
  }
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: translateY(40px);
}
</style>
