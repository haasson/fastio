<template>
  <article class="card-root" @click="$emit('open', dish)">
    <div class="photo">
      <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" loading="lazy" />
      <span v-else class="photo-placeholder">🍽</span>
      <div v-if="dish.tags.length" class="tags">
        <span v-for="tag in dish.tags.slice(0, 2)" :key="tag" class="tag">{{ tagLabel[tag] }}</span>
      </div>
    </div>

    <div class="body">
      <h3 class="dish-name">{{ dish.name }}</h3>
      <p v-if="dish.description" class="description">{{ dish.description }}</p>
      <div v-if="dish.nutrition" class="nutrition">
        {{ dish.nutrition.weight }}г · {{ dish.nutrition.calories }} ккал
      </div>
    </div>

    <div class="footer">
      <span class="price">{{ hasModifiers ? 'от ' : '' }}{{ dish.price }} ₽</span>
      <button class="add-btn" @click.stop="hasModifiers ? $emit('open', dish) : quickAdd()">
        <span>+</span>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Dish, DishTag } from '@fastio/shared'
import { useCartStore } from '~/stores/cart'

const props = defineProps<{ dish: Dish; hasModifiers?: boolean }>()
const emit = defineEmits<{ open: [dish: Dish] }>()

const cartStore = useCartStore()

const tagLabel: Record<DishTag, string> = {
  spicy: '🌶 Острое',
  vegetarian: '🥦 Вегет.',
  vegan: '🌱 Веган',
  new: '🆕 Новинка',
  popular: '⭐ Хит',
  hit: '🔥 Топ',
}

function quickAdd() {
  cartStore.add({
    dishId: props.dish.id,
    dishName: props.dish.name,
    price: props.dish.price,
    quantity: 1,
    removedIngredients: [],
    photo: props.dish.photos[0] ?? null,
  })
}
</script>

<style scoped lang="scss">
.card-root {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);

    .photo img {
      transform: scale(1.04);
    }
  }
}

.photo {
  position: relative;
  aspect-ratio: 4/3;
  background: #f5f5f5;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }
}

.photo-placeholder {
  font-size: 40px;
}

.tags {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  font-size: 10px;
  font-weight: 700;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  padding: 2px 6px;
  border-radius: 5px;
  backdrop-filter: blur(4px);
}

.body {
  padding: 12px 12px 8px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dish-name {
  font-size: 15px;
  font-weight: 700;
  color: #111;
  line-height: 1.3;
}

.description {
  font-size: 12px;
  color: #999;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.nutrition {
  font-size: 11px;
  color: #bbb;
  margin-top: 2px;
}

.footer {
  padding: 8px 12px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.price {
  font-size: 17px;
  font-weight: 800;
  color: #111;
}

.add-btn {
  width: 36px;
  height: 36px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 22px;
  font-weight: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  line-height: 1;

  &:hover {
    background: var(--primary-dark, #e55a25);
  }

  &:active {
    transform: scale(0.92);
  }
}
</style>
