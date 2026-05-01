<template>
  <!-- Mobile compact layout (shown only on mobile when mobileCompact is true) -->
  <FsCard
    v-if="mobileCompact"
    :class="['product-card-root', 'mobile-compact', { clickable: isClickable }]"
    @click="emit('cardClick')"
  >
    <div class="compact-inner">
      <div class="compact-photo">
        <img v-if="product.photos[0]" :src="product.photos[0]" :alt="product.name" loading="lazy" >
        <div v-else class="product-placeholder compact-placeholder">
          <component :is="placeholderIcon" :size="24" />
        </div>
      </div>
      <div class="compact-body">
        <FsText as="h3" variant="caption" :weight="600" class="compact-name">{{ product.name }}</FsText>
        <FsText v-if="product.description" as="p" variant="xs" class="compact-desc">{{ product.description }}</FsText>
        <FsText v-if="isService && duration" as="p" variant="xs" class="compact-duration">{{ formatMinutes(duration) }}</FsText>
        <div class="product-footer">
          <SfPriceTag
            :price="product.price"
            :prefix="dishPricePrefix"
            :currency="currency"
            size="small"
          />
          <SfStepper
            v-if="stepperCount !== null"
            :model-value="stepperCount"
            :min="0"
            size="small"
            @click.stop
            @update:model-value="onStepperUpdate"
          />
          <FsButton
            v-else-if="buttonAction"
            :variant="buttonAction.variant"
            size="small"
            @click.stop="onButtonClick"
          >
            <Trash2 v-if="buttonAction.icon === 'trash'" :size="16" />
            <Check v-else-if="buttonAction.icon === 'check'" :size="16" />
            <Plus v-else :size="16" />
            {{ buttonAction.label }}
          </FsButton>
        </div>
      </div>
    </div>
  </FsCard>

  <!-- Default vertical layout (hidden on mobile when mobileCompact is true) -->
  <FsCard
    :image-alt="product.name"
    :class="['product-card-root', { clickable: isClickable, 'hide-mobile': mobileCompact }]"
    @click="emit('cardClick')"
  >
    <template #image>
      <img v-if="product.photos[0]" class="product-photo" :src="product.photos[0]" :alt="product.name" loading="lazy" >
      <div v-else class="product-placeholder">
        <component :is="placeholderIcon" :size="32" />
      </div>
      <div v-if="product.tags.length" class="product-tags">
        <span
          v-for="rt in product.tags"
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
      <div v-if="useOverlay" class="product-overlay">
        <FsText as="h3" variant="body-sm" class="product-name">{{ product.name }}</FsText>
        <FsText v-if="product.description" variant="caption" class="product-desc-overlay">{{ product.description }}</FsText>
        <div class="product-footer">
          <SfPriceTag
            :price="product.price"
            :prefix="overlayPricePrefix"
            :currency="currency"
          />
          <SfStepper
            v-if="stepperCount !== null"
            :model-value="stepperCount"
            :min="0"
            size="small"
            @update:model-value="onStepperUpdate"
          />
          <FsButton
            v-else-if="buttonAction"
            :variant="buttonAction.variant"
            size="small"
            :responsive="true"
            @click="onButtonClick"
          >
            <Trash2 v-if="buttonAction.icon === 'trash'" :size="16" />
            <Check v-else-if="buttonAction.icon === 'check'" :size="16" />
            <Plus v-else :size="16" />
            {{ buttonAction.label }}
          </FsButton>
        </div>
      </div>
    </template>

    <div v-if="!useOverlay" class="product-body">
      <FsText as="h3" variant="body-sm" class="product-name">{{ product.name }}</FsText>
      <FsText v-if="product.description" variant="caption" class="product-desc">{{ product.description }}</FsText>
      <FsText v-if="isService && duration" variant="caption" class="product-duration">
        {{ formatMinutes(duration) }}
      </FsText>
      <div class="product-footer">
        <SfPriceTag
          :price="product.price"
          :prefix="dishPricePrefix"
          :currency="currency"
        />
        <SfStepper
          v-if="stepperCount !== null"
          :model-value="stepperCount"
          :min="0"
          size="small"
          @click.stop
          @update:model-value="onStepperUpdate"
        />
        <FsButton
          v-else-if="buttonAction"
          :variant="buttonAction.variant"
          size="small"
          :responsive="true"
          @click.stop="onButtonClick"
        >
          <Trash2 v-if="buttonAction.icon === 'trash'" :size="16" />
          <Check v-else-if="buttonAction.icon === 'check'" :size="16" />
          <Plus v-else :size="16" />
          {{ buttonAction.label }}
        </FsButton>
      </div>
    </div>
  </FsCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Check, Trash2 } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { formatMinutes } from '@fastio/shared'
import { FsCard, FsText, FsButton } from '@fastio/public-ui'
import { useItemPlaceholder } from '~/composables/useItemPlaceholder'
import { useCartStore } from '~/stores/cart'
import SfPriceTag from '~/components/sf/domain/SfPriceTag.vue'
import SfStepper from '~/components/sf/domain/SfStepper.vue'

type ProductTag = {
  id: string
  name: string
  preset: { color: string; background: string } | undefined
  iconComponent: unknown
}

type ProductData = {
  id: string
  name: string
  description?: string | null
  photos: string[]
  price: number
  tags: ProductTag[]
}

type Props = {
  variant: 'dish' | 'service'
  product: ProductData
  currency?: string
  mobileCompact?: boolean
  overlay?: boolean
  // dish-specific
  hasModifiers?: boolean
  hideStepper?: boolean
  orderingEnabled?: boolean
  cartCount?: number
  // service-specific
  duration?: number
  canBook?: boolean
  inCart?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currency: '₽',
  orderingEnabled: true,
  cartCount: 0,
  hasModifiers: false,
  hideStepper: false,
  overlay: false,
  mobileCompact: false,
  duration: 0,
  canBook: false,
  inCart: false,
})

const emit = defineEmits<{
  cardClick: []
  add: []
  remove: []
  increment: []
  decrement: []
}>()

const { placeholderIcon } = useItemPlaceholder()
const { restored: cartRestored } = storeToRefs(useCartStore())

type ButtonAction = {
  label: string
  icon: 'plus' | 'check' | 'trash'
  variant: 'primary' | 'secondary' | 'ghost'
  emit: 'add' | 'remove'
}

// Discriminated variant — выносим из шаблона в computed.
const isDish = computed(() => props.variant === 'dish')
const isService = computed(() => props.variant === 'service')

// Префикс "от" — только для блюд с модификаторами.
const dishPricePrefix = computed(() => (isDish.value && props.hasModifiers ? 'от' : undefined))
const overlayPricePrefix = computed(() => (props.hasModifiers ? 'от' : undefined))

const stepperCount = computed<number | null>(() => {
  if (!isDish.value) return null
  if (!props.orderingEnabled) return null
  if (props.hideStepper) return null
  if (!cartRestored.value) return null
  return props.cartCount > 0 ? props.cartCount : null
})

// Скрываем кнопку до завершения cart.restore() — иначе на возвращающемся юзере
// сначала рендерится "В корзину", потом моргает на "Убрать". Состояние корзины
// должно быть актуальным к моменту первого рендера футера.
const buttonAction = computed<ButtonAction | null>(() => {
  if (!cartRestored.value) return null
  if (isDish.value) {
    if (!props.orderingEnabled) return null
    if (stepperCount.value !== null) return null
    return { label: 'Добавить', icon: 'plus', variant: 'primary', emit: 'add' }
  }
  // service
  if (!props.canBook) return null
  return props.inCart
    ? { label: 'Убрать', icon: 'trash', variant: 'ghost', emit: 'remove' }
    : { label: 'В корзину', icon: 'plus', variant: 'primary', emit: 'add' }
})

function onButtonClick() {
  if (!buttonAction.value) return
  if (buttonAction.value.emit === 'remove') emit('remove')
  else emit('add')
}

const isClickable = computed(() => {
  if (isDish.value) return props.orderingEnabled
  return true
})

const useOverlay = computed(() => props.overlay && isDish.value)

function onStepperUpdate(newVal: number) {
  if (stepperCount.value === null) return
  if (newVal < stepperCount.value) emit('decrement')
  else emit('increment')
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.product-card-root {
  max-width: 400px;
  margin-inline: auto;
  width: 100%;

  &.clickable { cursor: pointer; }

  @include md { max-width: none; margin-inline: 0; }
}

.product-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.product-placeholder {
  width: 100%;
  height: 100%;
  @include flex-row;
  justify-content: center;
  background: var(--color-border);
  color: var(--color-text-muted);
}

.product-tags {
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

.product-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 130px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  @include flex-col(4px);

  .product-name { color: #fff; }
  .product-footer { color: #fff; }
  :deep(.price-main) { color: #fff; }
  :deep(.price-prefix) { color: rgba(255, 255, 255, 0.8); }
  :deep(.price-old) { color: rgba(255, 255, 255, 0.5); }
  :deep(.stepper-root) { border-color: rgba(255, 255, 255, 0.3); }
  :deep(.stepper-value) { color: #fff; }
  :deep(.stepper-btn) { color: #fff; }
  .product-desc-overlay {
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.product-body {
  padding: 12px;
  @include flex-col(8px);
  flex: 1;
}

.product-name {
  font-weight: 600;
  line-height: 1.3;
}

.product-desc {
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.product-duration {
  color: var(--color-text-secondary);
}

.product-footer {
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

.compact-duration {
  @include text-xs;
  color: var(--color-text-secondary);
  line-height: 1.4;
  margin: 0;
}
</style>
