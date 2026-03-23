<template>
  <div class="cart-item-root">
    <div class="item-photo">
      <img v-if="item.photo" :src="item.photo" :alt="item.dishName" class="item-img" loading="lazy" />
      <div v-else class="item-placeholder">
        <UtensilsCrossed :size="24" />
      </div>
    </div>

    <div class="item-body">
      <div class="item-top">
        <span class="item-name">{{ item.dishName }}</span>
        <span class="item-price">{{ itemTotal }} {{ currency }}</span>
      </div>

      <p v-if="modifiersSummary" class="item-mods">{{ modifiersSummary }}</p>
      <p v-if="removedSummary" class="item-removed">{{ removedSummary }}</p>

      <div class="item-controls">
        <div class="item-left">
          <span class="unit-price">{{ unitPrice }} {{ currency }} / шт.</span>
          <SfStepper
            :model-value="item.quantity"
            size="small"
            :min="1"
            :max="99"
            @update:model-value="onQtyChange"
          />
        </div>

        <div class="item-btns">
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
import { Pencil, Trash2, UtensilsCrossed } from 'lucide-vue-next'
import { getItemUnitPrice } from '@fastio/shared'
import type { CartItem } from '~/stores/cart'
import SfStepper from '~/components/sf/domain/SfStepper.vue'
import { FsIconButton } from '@fastio/public-ui'
import { useConfirm } from '~/composables/useConfirm'

type Props = {
  item: CartItem
  index: number
  currency?: string
  canEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currency: '₽',
  canEdit: true,
})

const emit = defineEmits<{
  'change': [index: number, quantity: number]
  'remove': [index: number]
  'edit': [index: number]
}>()

const unitPrice = computed(() => getItemUnitPrice(props.item))
const itemTotal = computed(() => unitPrice.value * props.item.quantity)

const modifiersSummary = computed(() => {
  const parts: string[] = []
  if (props.item.modifiers?.length) {
    parts.push(...props.item.modifiers.map((m) => m.optionName))
  }
  if (props.item.addons?.length) {
    parts.push(...props.item.addons.map((a) => `+ ${a.addonName}`))
  }
  return parts.join(' · ')
})

const removedSummary = computed(() => {
  if (!props.item.removedIngredients?.length) return ''
  const names = props.item.removedIngredients.map((s) => s.toLowerCase()).join(', ')
  return `Убрать: ${names}`
})

function onQtyChange(newVal: number) {
  emit('change', props.index, newVal)
}

const { confirm } = useConfirm()

async function onDeleteClick() {
  const ok = await confirm(`Убрать «${props.item.dishName}» из корзины?`, {
    title: 'Удалить товар?',
    confirmLabel: 'Удалить',
    danger: true,
  })
  if (ok) emit('remove', props.index)
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.cart-item-root {
  display: flex;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.item-photo {
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

.item-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-placeholder {
  width: 100%;
  height: 100%;
  @include flex-row;
  justify-content: center;
  color: var(--color-text-muted);
  opacity: 0.4;
}

.item-body {
  @include flex-fill;
  @include flex-col(4px);
}

.item-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.item-name {
  @include text-caption(600);
  color: var(--color-text);
  line-height: 1.3;

  @include md {
    @include text-body-sm;
  }
}

.item-price {
  @include text-body-sm(700);
  color: var(--color-text);
  flex-shrink: 0;
}

.item-mods {
  @include text-xs;
  color: var(--color-text-secondary);
  line-height: 1.4;
  margin: 0;
}

.item-removed {
  @include text-xs;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin: 0;
}

.item-controls {
  @include flex-between(8px);
  margin-top: 4px;
}

.item-left {
  @include flex-row(10px);
}

.unit-price {
  @include text-xs;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.item-btns {
  @include flex-row(2px);
}

.btn-danger {
  color: var(--color-text-muted);

  &:hover {
    color: var(--color-error, #ef4444);
    background: color-mix(in srgb, var(--color-error, #ef4444) 10%, transparent) !important;
  }
}

</style>
