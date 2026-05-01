<template>
  <div class="cart-line-root">
    <div class="line-photo">
      <img v-if="displayPhoto" :src="displayPhoto" :alt="displayName" class="line-img" loading="lazy" >
      <div v-else class="line-placeholder">
        <component :is="placeholderIcon" :size="24" />
      </div>
    </div>

    <div class="line-body">
      <div class="line-top">
        <FsText as="span" variant="body-sm" class="line-name">{{ displayName }}</FsText>
        <FsText v-if="totalPrice !== null" as="span" variant="body-sm" class="line-price">{{ totalPrice }} {{ currency }}</FsText>
      </div>

      <FsText v-if="summary" as="p" variant="caption" class="line-mods">{{ summary }}</FsText>

      <div v-if="isService && serviceItem" class="line-meta">
        <FsText as="span" variant="caption" class="line-duration">{{ serviceItem.duration }} мин</FsText>
        <FsText as="span" variant="caption" class="line-master">{{ masterLabel }}</FsText>
      </div>

      <div class="line-controls">
        <div class="line-left">
          <template v-if="isDish && dishItem">
            <FsText as="span" variant="caption" class="unit-price">{{ unitPrice }} {{ currency }} / шт.</FsText>
            <SfStepper
              :model-value="dishItem.quantity"
              size="small"
              :min="1"
              :max="99"
              @update:model-value="onQtyChange"
            />
          </template>
        </div>

        <div class="line-btns">
          <FsIconButton
            v-if="canEdit"
            aria-label="Редактировать"
            variant="ghost"
            size="small"
            @click="emit('edit', index)"
          >
            <Pencil :size="16" />
          </FsIconButton>
          <FsIconButton
            aria-label="Удалить"
            variant="ghost"
            size="small"
            class="btn-danger"
            @click="onDeleteClick"
          >
            <Trash2 :size="16" />
          </FsIconButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Pencil, Trash2 } from 'lucide-vue-next'
import { getItemUnitPrice, getItemSummary } from '@fastio/shared'
import type { CartItem, DishCartItem, ServiceCartItem } from '~/stores/cart'
import { isDishItem, isServiceItem } from '~/stores/cart'
import SfStepper from '~/components/sf/domain/SfStepper.vue'
import { FsIconButton, FsText } from '@fastio/public-ui'
import { useConfirm } from '~/composables/useConfirm'
import { useItemPlaceholder } from '~/composables/useItemPlaceholder'
import { useResourceLabel } from '~/composables/useResourceLabel'

const { placeholderIcon } = useItemPlaceholder()
const { anyLabel: anyResourceLabel } = useResourceLabel()

type Props = {
  item: CartItem
  index: number
  currency?: string
  canEdit?: boolean
  resources?: Array<{ id: string; name: string }>
}

const props = withDefaults(defineProps<Props>(), {
  currency: '₽',
  canEdit: true,
  resources: () => [],
})

const emit = defineEmits<{
  'change': [index: number, quantity: number]
  'remove': [index: number]
  'edit': [index: number]
}>()

// Discriminated union — выносим из шаблона в computed.
const isDish = computed(() => isDishItem(props.item))
const isService = computed(() => isServiceItem(props.item))
const dishItem = computed<DishCartItem | null>(() =>
  isDishItem(props.item) ? props.item : null,
)
const serviceItem = computed<ServiceCartItem | null>(() =>
  isServiceItem(props.item) ? props.item : null,
)

const displayName = computed(() =>
  dishItem.value ? dishItem.value.dishName : serviceItem.value?.serviceName ?? '',
)

const displayPhoto = computed(() => props.item.photo)

const summary = computed(() => (dishItem.value ? getItemSummary(dishItem.value) : null))

const unitPrice = computed(() =>
  dishItem.value ? getItemUnitPrice(dishItem.value) : serviceItem.value?.price ?? 0,
)

const totalPrice = computed<number | null>(() => {
  if (dishItem.value) {
    return getItemUnitPrice(dishItem.value) * dishItem.value.quantity
  }
  const sv = serviceItem.value
  return sv && sv.price > 0 ? sv.price : null
})

const masterLabel = computed(() => {
  const sv = serviceItem.value
  if (!sv) return ''
  if (!sv.preferredResourceId) return anyResourceLabel.value
  const found = props.resources.find((r) => r.id === sv.preferredResourceId)
  return found?.name ?? anyResourceLabel.value
})

const confirmTitle = computed(() =>
  isDish.value ? 'Удалить товар?' : 'Удалить услугу?',
)

function onQtyChange(newVal: number) {
  emit('change', props.index, newVal)
}

const { confirm } = useConfirm()

async function onDeleteClick() {
  const ok = await confirm(`Убрать «${displayName.value}» из корзины?`, {
    title: confirmTitle.value,
    confirmLabel: 'Удалить',
    danger: true,
  })
  if (ok) emit('remove', props.index)
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.cart-line-root {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.line-photo {
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-surface);

  @include md {
    width: 88px;
    height: 88px;
  }
}

.line-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.line-placeholder {
  width: 100%;
  height: 100%;
  @include flex-row;
  justify-content: center;
  color: var(--color-text-muted);
  opacity: 0.4;
}

.line-body {
  @include flex-fill;
  @include flex-col(4px);
}

.line-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.line-name {
  @include text-caption(600);
  color: var(--color-text);
  line-height: 1.3;

  @include md {
    @include text-body-sm;
  }
}

.line-price {
  @include text-body-sm(700);
  color: var(--color-text);
  flex-shrink: 0;
}

.line-mods {
  @include text-xs;
  color: var(--color-text-secondary);
  line-height: 1.4;
  margin: 0;
}

.line-meta {
  @include flex-row(10px);
}

.line-duration {
  @include text-xs;
  color: var(--color-text-secondary);
}

.line-master {
  @include text-xs;
  color: var(--color-text-secondary);
}

.line-controls {
  @include flex-between(8px);
  margin-top: 4px;
}

.line-left {
  @include flex-row(10px);
  flex: 1;
  min-width: 0;
}

.unit-price {
  @include text-xs;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.line-btns {
  @include flex-row(2px);
}

.btn-danger {
  color: var(--color-text-muted);

  &:hover {
    color: var(--color-error);
    background: color-mix(in srgb, var(--color-error) 10%, transparent) !important;
  }
}
</style>
