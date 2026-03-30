<template>
  <FsCard :image-alt="dish.name" :class="['dish-card-root', { clickable: isServices || orderingEnabled }]" @click="emit('cardClick')">
    <template #image>
      <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" loading="lazy" />
      <div v-else class="dish-placeholder">
        <UtensilsCrossed :size="32" />
      </div>
      <div v-if="resolvedTags.length" class="dish-tags">
        <span
          v-for="rt in resolvedTags"
          :key="rt.id"
          class="tag"
          :style="{ color: rt.preset?.color, background: rt.preset?.background }"
        >
          <component
            v-if="rt.iconComponent"
            :is="rt.iconComponent"
            :size="13"
            :stroke-width="2.5"
          />
          {{ rt.name }}
        </span>
      </div>
    </template>

    <div class="dish-body">
      <FsText as="h3" variant="body-sm" class="dish-name">{{ dish.name }}</FsText>
      <FsText v-if="dish.description" variant="caption" class="dish-desc">{{ dish.description }}</FsText>
      <div class="dish-footer" @click.stop>
        <SfPriceTag :price="dish.price" :prefix="hasModifiers ? 'от' : undefined" :currency="currency" />
        <FsButton v-if="isServices" variant="primary" size="small" :responsive="true" @click.stop="emit('request')">
          Оставить заявку
        </FsButton>
        <SfStepper
          v-else-if="orderingEnabled && cartCount > 0 && !hideStepper"
          :model-value="cartCount"
          :min="0"
          size="small"
          @update:model-value="(val) => val < cartCount ? onDecrement() : onIncrement()"
        />
        <FsButton v-else-if="orderingEnabled" variant="primary" size="small" :responsive="true" @click="emit('add')">
          <Plus :size="16" />
          Добавить
        </FsButton>
      </div>
    </div>
  </FsCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Plus, UtensilsCrossed } from 'lucide-vue-next'
import type { Dish, Combo } from '@fastio/shared'
import { getTagColorPreset } from '@fastio/shared'
import { FsCard, FsText, FsButton } from '@fastio/public-ui'
import SfPriceTag from '~/components/sf/domain/SfPriceTag.vue'
import SfStepper from '~/components/sf/domain/SfStepper.vue'
import { useCartStore, type CartItem } from '~/stores/cart'
import { useMenuStore } from '~/stores/menu'
import { resolveTagIcon } from '~/utils/tag-icons'

type Props = {
  dish: Dish | Combo
  comboId?: string
  hasModifiers?: boolean
  currency?: string
  hideStepper?: boolean
  isServices?: boolean
  orderingEnabled?: boolean
}

const props = withDefaults(defineProps<Props>(), { currency: '₽', orderingEnabled: true })
const emit = defineEmits<{ add: []; cardClick: []; request: [] }>()
const cart = useCartStore()
const menuStore = useMenuStore()

const resolvedTags = computed(() =>
  props.dish.tags
    .map((tagId) => {
      const def = menuStore.tagDefinitions.find((t) => t.id === tagId)
      if (!def) return null
      const preset = getTagColorPreset(def.color)
      const iconComponent = resolveTagIcon(def.icon)
      return { id: def.id, name: def.name, preset, iconComponent }
    })
    .filter(Boolean) as { id: string; name: string; preset: { color: string; background: string } | undefined; iconComponent: unknown }[],
)

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

.dish-card-root {
  max-width: 400px;
  margin-inline: auto;
  width: 100%;

  &.clickable { cursor: pointer; }

  @include md { max-width: none; margin-inline: 0; }
}

.dish-placeholder {
  width: 100%;
  height: 100%;
  @include flex-row;
  justify-content: center;
  background: var(--color-border);
  color: var(--color-text-muted);
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
  @include text-xs(600);
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
}


.dish-body {
  padding: 12px;
  @include flex-col(8px);
  flex: 1;
}

.dish-name {
  font-weight: 600;
  line-height: 1.3;
}

.dish-desc {
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.dish-footer {
  margin-top: auto;
  @include flex-between(8px);
  min-height: 36px;

  @include lg { min-height: 44px; }
}
</style>
