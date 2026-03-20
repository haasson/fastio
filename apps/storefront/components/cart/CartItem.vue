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

        <div v-if="!confirmingDelete" class="item-btns">
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
            @click="startConfirmDelete"
          >
            <Trash2 :size="16" />
          </FsIconButton>
        </div>

        <div v-else class="delete-confirm">
          <span class="delete-label">Удалить?</span>
          <button type="button" class="confirm-btn confirm-yes" @click="confirmDelete">Да</button>
          <button type="button" class="confirm-btn confirm-no" @click="cancelConfirmDelete">Нет</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { Pencil, Trash2, UtensilsCrossed } from 'lucide-vue-next'
import { getItemUnitPrice } from '@fastio/shared'
import type { CartItem } from '~/stores/cart'
import SfStepper from '~/components/sf/domain/SfStepper.vue'
import { FsIconButton } from '@fastio/public-ui'

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
  return `без ${names}`
})

function onQtyChange(newVal: number) {
  emit('change', props.index, newVal)
}

// Delete confirmation
const confirmingDelete = ref(false)
let cancelTimer: ReturnType<typeof setTimeout> | null = null

function startConfirmDelete() {
  confirmingDelete.value = true
  cancelTimer = setTimeout(() => { confirmingDelete.value = false }, 4000)
}

function confirmDelete() {
  if (cancelTimer) clearTimeout(cancelTimer)
  confirmingDelete.value = false
  emit('remove', props.index)
}

function cancelConfirmDelete() {
  if (cancelTimer) clearTimeout(cancelTimer)
  confirmingDelete.value = false
}

onUnmounted(() => {
  if (cancelTimer) clearTimeout(cancelTimer)
})
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
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  opacity: 0.4;
}

.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.item-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.3;

  @include md {
    font-size: 15px;
  }
}

.item-price {
  font-weight: 700;
  font-size: 15px;
  color: var(--color-text);
  flex-shrink: 0;
}

.item-mods {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
  margin: 0;
}

.item-removed {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin: 0;
}

.item-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.unit-price {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.item-btns {
  display: flex;
  gap: 2px;
}

.btn-danger {
  color: var(--color-text-muted);

  &:hover {
    color: var(--color-error, #ef4444);
    background: color-mix(in srgb, var(--color-error, #ef4444) 10%, transparent) !important;
  }
}

// Delete confirmation
.delete-confirm {
  display: flex;
  align-items: center;
  gap: 6px;
  animation: fade-in 0.15s ease;
}

@keyframes fade-in {
  from { opacity: 0; transform: translateX(4px); }
  to { opacity: 1; transform: translateX(0); }
}

.delete-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.confirm-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-btn);
  border: none;
  cursor: pointer;
  transition: background 0.1s;
}

.confirm-yes {
  background: var(--color-error, #ef4444);
  color: #fff;

  &:hover {
    background: color-mix(in srgb, var(--color-error, #ef4444) 82%, #000);
  }
}

.confirm-no {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);

  &:hover {
    background: var(--surface-hover);
  }
}
</style>
