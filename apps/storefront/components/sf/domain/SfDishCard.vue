<template>
  <SfCard :image="dish.photos[0]" :image-alt="dish.name" class="dish-card-root">
    <template v-if="dish.tags.length" #image>
      <img :src="dish.photos[0]" :alt="dish.name" loading="lazy" />
      <div class="dish-tags">
        <span
          v-for="tag in dish.tags"
          :key="tag"
          class="tag"
          :style="{ color: getDishTagConfig(tag)?.color, background: getDishTagConfig(tag)?.background }"
        >
          <component v-if="getTagIcon(tag)" :is="getTagIcon(tag)" :size="13" :stroke-width="2.5" />
          {{ getDishTagConfig(tag)?.label ?? tag }}
        </span>
      </div>
    </template>

    <div class="dish-body">
      <SfText as="h3" variant="body-sm" class="dish-name">{{ dish.name }}</SfText>
      <SfText v-if="dish.description" variant="caption" class="dish-desc">{{ dish.description }}</SfText>
      <div class="dish-footer">
        <SfPriceTag :price="dish.price" :currency="currency" />
        <SfStepper
          v-if="cartCount > 0"
          :model-value="cartCount"
          :min="0"
          size="small"
          @update:model-value="(val) => val < cartCount ? onDecrement() : onIncrement()"
        />
        <SfButton v-else variant="primary" size="small" :responsive="true" @click="emit('add')">
          <Plus :size="16" />
          Добавить
        </SfButton>
      </div>
    </div>
  </SfCard>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Plus, Flame, Leaf, Sparkles, Star, Zap, type LucideIcon } from 'lucide-vue-next'
import { getDishTagConfig } from '@fastio/shared'
import SfCard from '~/components/sf/layout/SfCard.vue'
import SfText from '~/components/sf/typography/SfText.vue'
import SfButton from '~/components/sf/base/SfButton.vue'
import SfPriceTag from '~/components/sf/domain/SfPriceTag.vue'
import SfStepper from '~/components/sf/domain/SfStepper.vue'
import { useCartStore } from '~/stores/cart'

type DishProp = {
  id: string
  name: string
  description: string
  price: number
  photos: string[]
  tags: string[]
}

type Props = {
  dish: DishProp
  currency?: string
}

const props = withDefaults(defineProps<Props>(), { currency: '₽' })
const emit = defineEmits<{ add: [] }>()
const cart = useCartStore()

const cartCount = computed(() =>
  cart.items.filter(i => i.dishId === props.dish.id).reduce((s, i) => s + i.quantity, 0)
)
const firstCartIndex = computed(() => cart.items.findIndex(i => i.dishId === props.dish.id))

function onIncrement() { if (firstCartIndex.value !== -1) cart.increment(firstCartIndex.value) }
function onDecrement() { if (firstCartIndex.value !== -1) cart.decrement(firstCartIndex.value) }

const iconMap: Record<string, LucideIcon> = { Flame, Leaf, Sparkles, Star, Zap }

function getTagIcon(tag: string): Component | null {
  const config = getDishTagConfig(tag)
  return config ? (iconMap[config.icon] ?? null) : null
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.dish-card-root {
  max-width: 400px;
  margin-inline: auto;
  width: 100%;

  @include md { max-width: none; margin-inline: 0; }
}

.dish-tags {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  z-index: 1;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
}


.dish-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.dish-name {
  font-weight: 600;
  line-height: 1.3;
}

.dish-desc {
  line-height: 1.4;
  color: var(--color-text-muted);
}

.dish-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;

  @include lg { min-height: 44px; }
}
</style>
