<template>
  <FsCard
    :image-alt="dish.name"
    :horizontal="true"
    image-size="80px"
    class="dish-card-compact-root"
  >
    <template #image>
      <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" loading="lazy" />
      <div v-else class="compact-placeholder">
        <UtensilsCrossed :size="20" />
      </div>
    </template>
    <div class="compact-body">
      <h3 class="compact-name">{{ dish.name }}</h3>
      <p v-if="dish.description" class="compact-desc">{{ dish.description }}</p>
      <div class="compact-footer">
        <SfPriceTag :price="dish.price" :currency="currency" size="small" />
        <SfStepper
          v-if="cartCount > 0"
          :model-value="cartCount"
          :min="0"
          size="small"
          @update:model-value="(val) => val < cartCount ? onDecrement() : onIncrement()"
        />
        <FsButton v-else variant="primary" size="small" @click="emit('add')">
          <Plus :size="16" />
        </FsButton>
      </div>
    </div>
  </FsCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Plus, UtensilsCrossed } from 'lucide-vue-next'
import { type Dish } from '@fastio/shared'
import { FsCard, FsButton } from '@fastio/public-ui'
import SfPriceTag from '~/components/sf/domain/SfPriceTag.vue'
import SfStepper from '~/components/sf/domain/SfStepper.vue'
import { useCartStore, type CartItem } from '~/stores/cart'

type Props = {
  dish: Dish
  comboId?: string
  currency?: string
}

const props = withDefaults(defineProps<Props>(), { currency: '₽' })
const emit = defineEmits<{ add: [] }>()
const cart = useCartStore()

const itemPred = computed(() =>
  props.comboId
    ? (i: CartItem) => i.comboId === props.comboId
    : (i: CartItem) => i.dishId === props.dish.id,
)

const cartCount = computed(() =>
  cart.items.filter(itemPred.value).reduce((s, i) => s + i.quantity, 0),
)
const firstCartIndex = computed(() =>
  cart.items.findIndex(itemPred.value),
)

function onIncrement() { if (firstCartIndex.value !== -1) cart.increment(firstCartIndex.value) }
function onDecrement() { if (firstCartIndex.value !== -1) cart.decrement(firstCartIndex.value) }
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.compact-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-border);
  color: var(--color-text-muted);
}

.dish-card-compact-root {
  border-radius: 0;
  box-shadow: none;
  border-bottom: 1px solid var(--color-border);

  &:hover { box-shadow: none; }
  &:last-child { border-bottom: none; }
}

.compact-body {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.compact-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}
</style>
