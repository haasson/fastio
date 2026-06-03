<template>
  <UiModal
    :model-value="modelValue"
    :title="`Расчёт: ${table?.name ?? ''}`"
    :width="520"
    closable
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="checkout-root">
      <TableSessionItems
        :session="session"
        :kitchen-dishes="kitchenDishes"
        :ready-dishes="readyDishes"
        :show-stats="false"
        no-add
        checkout-mode
        @remove-dish="$emit('remove-dish', $event)"
        @confirm-item="$emit('confirm-item', $event)"
        @reject-item="$emit('reject-item', $event)"
        @confirm-all="$emit('confirm-all')"
        @cancel-kitchen="onCancelKitchen"
        @serve-kitchen="$emit('serve-kitchen', $event)"
      />

      <div class="divider" />

      <!-- Discount -->
      <div class="discount-row">
        <span class="discount-label">Скидка</span>
        <div class="discount-controls">
          <UiButton
            :type="discountType === 'percent' ? 'primary' : 'default'"
            size="small"
            @click="discountType = 'percent'"
          >%</UiButton>
          <UiButton
            :type="discountType === 'rub' ? 'primary' : 'default'"
            size="small"
            @click="discountType = 'rub'"
          >₽</UiButton>
          <input
            v-model.number="discountValue"
            class="discount-input"
            type="number"
            min="0"
            :max="discountType === 'percent' ? 100 : undefined"
            placeholder="0"
          />
        </div>
      </div>

      <!-- Total -->
      <div class="total-row">
        <template v-if="compensationAmount > 0 || discountAmount > 0">
          <span class="total-original">{{ formatPrice(session?.sum ?? 0) }}</span>
        </template>
        <span v-if="compensationAmount > 0" class="total-discount">− {{ formatPrice(compensationAmount) }} отмена</span>
        <span v-if="discountAmount > 0" class="total-discount">− {{ formatPrice(discountAmount) }} скидка</span>
        <span class="total-label">Итого</span>
        <span class="total-sum">{{ formatPrice(finalSum) }}</span>
      </div>
    </div>

    <template #footer>
      <div class="checkout-actions">
        <UiButton type="default" @click="$emit('update:modelValue', false)">Отмена</UiButton>
        <UiButton
          type="warning"
          :loading="loading"
          :disabled="activeKitchenCount > 0"
          @click="onConfirm"
        >Закрыть стол</UiButton>
      </div>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiButton } from '@fastio/ui'
import type { Table, KitchenQueueItem } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import type { TableSession, TableSessionItem } from '../api/tables'
import TableSessionItems from './TableSessionItems.vue'

type Props = {
  modelValue: boolean
  table: Table | null
  session?: TableSession
  kitchenDishes?: KitchenQueueItem[]
  readyDishes?: KitchenQueueItem[]
  loading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': [discountAmount: number]
  'remove-dish': [item: TableSessionItem]
  'confirm-item': [itemId: string]
  'reject-item': [itemId: string]
  'confirm-all': []
  'cancel-kitchen': [ids: string[], charged: boolean]
  'serve-kitchen': [ids: string[]]
}>()

const discountType = ref<'percent' | 'rub'>('percent')
const discountValue = ref<number>(0)
const compensationAmount = ref(0)

const activeKitchenCount = computed(() => (props.kitchenDishes ?? []).filter((i) => i.status === 'queued' || i.status === 'in_progress' || i.status === 'done',
).length,
)

const discountAmount = computed(() => {
  const sum = props.session?.sum ?? 0

  if (!discountValue.value || discountValue.value <= 0) return 0
  if (discountType.value === 'percent') {
    return Math.round(sum * Math.min(discountValue.value, 100) / 100)
  }

  return Math.min(discountValue.value, sum)
})

const finalSum = computed(() => Math.max(0, (props.session?.sum ?? 0) - compensationAmount.value - discountAmount.value))

// TableSessionItems emits (ids, amount, charged) — intercept amount for local compensation tracking,
// then forward only (ids, charged) to parent for the actual API call
const onCancelKitchen = (ids: string[], amount: number, charged: boolean) => {
  if (!charged) {
    compensationAmount.value += amount
  }

  emit('cancel-kitchen', ids, charged)
}

const onConfirm = () => {
  emit('confirm', discountAmount.value + compensationAmount.value)
}

watch(() => props.modelValue, (open) => {
  if (open) {
    compensationAmount.value = 0
    discountValue.value = 0
    discountType.value = 'percent'
  }
})
</script>

<style scoped lang="scss">
.checkout-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.divider {
  height: 1px;
  background: var(--color-border);
}

.discount-row {
  display: flex;
  align-items: center;
  gap: var(--space-12);
}

.discount-label {
  font-size: var(--font-size-md);
  color: var(--color-text-hint);
  flex-shrink: 0;
}

.discount-controls {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin-left: auto;
}

.discount-input {
  width: 80px;
  height: 30px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  padding: 0 var(--space-8);
  font-size: var(--font-size-md);
  color: var(--color-title);
  background: var(--color-bg);
  outline: none;
  text-align: right;

  &:focus {
    border-color: var(--color-primary);
  }

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
  }
}

.total-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
}

.total-original {
  font-size: var(--font-size-base);
  color: var(--color-text-hint);
  text-decoration: line-through;
}

.total-discount {
  font-size: var(--font-size-base);
  color: var(--color-error);
}

.total-label {
  flex: 1;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
}

.total-sum {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-title);
}

.checkout-actions {
  display: flex;
  gap: var(--space-8);

  > * {
    flex: 1;
  }
}
</style>
