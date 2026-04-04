<template>
  <!-- Mobile compact layout (shown only on mobile when mobileCompact is true) -->
  <FsCard
    v-if="mobileCompact"
    :class="['dish-card-root', 'mobile-compact', { clickable: isServices || orderingEnabled }]"
    @click="emit('cardClick')"
  >
    <div class="compact-inner">
      <div class="compact-photo">
        <img v-if="dish.photos[0]" :src="dish.photos[0]" :alt="dish.name" loading="lazy" >
        <div v-else class="dish-placeholder compact-placeholder">
          <UtensilsCrossed :size="24" />
        </div>
      </div>
      <div class="compact-body">
        <h3 class="compact-name">{{ dish.name }}</h3>
        <p v-if="dish.description" class="compact-desc">{{ dish.description }}</p>
        <div class="dish-footer">
          <SfPriceTag :price="dish.price" :prefix="hasModifiers ? 'от' : undefined" :currency="currency" size="small" />
          <FsButton v-if="isServices" variant="primary" size="small" @click.stop="emit('request')">
            Заявка
          </FsButton>
          <template v-else-if="orderingEnabled">
            <SfStepper
              v-if="cartCount > 0 && !hideStepper"
              :model-value="cartCount"
              :min="0"
              size="small"
              @click.stop
              @update:model-value="(val) => val < cartCount ? onDecrement() : onIncrement()"
            />
            <FsButton v-else variant="primary" size="small" @click.stop="emit('add')">
              <Plus :size="16" />
              Добавить
            </FsButton>
          </template>
        </div>
      </div>
    </div>
  </FsCard>

  <!-- Default vertical layout (hidden on mobile when mobileCompact is true) -->
  <FsCard :image-alt="dish.name" :class="['dish-card-root', { clickable: isServices || orderingEnabled, 'hide-mobile': mobileCompact }]" @click="emit('cardClick')">
    <template #image>
      <img v-if="dish.photos[0]" class="dish-photo" :src="dish.photos[0]" :alt="dish.name" loading="lazy" >
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
            :is="rt.iconComponent"
            v-if="rt.iconComponent"
            :size="13"
            :stroke-width="2.5"
          />
          {{ rt.name }}
        </span>
      </div>
      <div v-if="overlay" class="dish-overlay">
        <FsText as="h3" variant="body-sm" class="dish-name">{{ dish.name }}</FsText>
        <FsText v-if="dish.description" variant="caption" class="dish-desc-overlay">{{ dish.description }}</FsText>
        <div class="dish-footer">
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
    </template>

    <div v-if="!overlay" class="dish-body">
      <FsText as="h3" variant="body-sm" class="dish-name">{{ dish.name }}</FsText>
      <FsText v-if="dish.description" variant="caption" class="dish-desc">{{ dish.description }}</FsText>
      <div class="dish-footer">
        <SfPriceTag :price="dish.price" :prefix="hasModifiers ? 'от' : undefined" :currency="currency" />
        <FsButton v-if="isServices" variant="primary" size="small" :responsive="true" @click.stop="emit('request')">
          Оставить заявку
        </FsButton>
        <SfStepper
          v-else-if="orderingEnabled && cartCount > 0 && !hideStepper"
          :model-value="cartCount"
          :min="0"
          size="small"
          @click.stop
          @update:model-value="(val) => val < cartCount ? onDecrement() : onIncrement()"
        />
        <FsButton v-else-if="orderingEnabled" variant="primary" size="small" :responsive="true" @click.stop="emit('add')">
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
  overlay?: boolean
  mobileCompact?: boolean
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

.dish-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
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


.dish-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 130px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  @include flex-col(4px);

  .dish-name { color: #fff; }
  .dish-footer { color: #fff; }
  :deep(.price-main) { color: #fff; }
  :deep(.price-prefix) { color: rgba(255, 255, 255, 0.8); }
  :deep(.price-old) { color: rgba(255, 255, 255, 0.5); }
  :deep(.stepper-root) { border-color: rgba(255, 255, 255, 0.3); }
  :deep(.stepper-value) { color: #fff; }
  :deep(.stepper-btn) { color: #fff; }
  .dish-desc-overlay {
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
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

// Mobile compact
.mobile-compact {
  display: none;
  max-width: none;
  @media (max-width: 767px) { display: flex; }
}

.hide-mobile {
  @media (max-width: 767px) { display: none; }
}

.compact-inner {
  display: flex;
  gap: 12px;
  padding: 12px;
}

.compact-photo {
  width: 110px;
  height: 110px;
  flex-shrink: 0;
  border-radius: var(--radius-card);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.compact-placeholder {
  border-radius: var(--radius-card);
}

.compact-body {
  @include flex-col(6px);
  flex: 1;
  min-width: 0;
}

.compact-name {
  @include text-caption(600);
  color: var(--color-text);
  line-height: 1.3;
  margin: 0;
}

.compact-desc {
  @include text-xs;
  color: var(--color-text-secondary);
  line-height: 1.4;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
