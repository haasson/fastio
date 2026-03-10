<template>
  <UiCard
    clickable
    class="card-root"
    :style="currentStatus ? { outline: `1px solid ${STATUS_GROUP_COLORS[currentStatus.groupType]}` } : undefined"
    @click="emit('open-edit', order)"
  >
    <!-- Шапка -->
    <div class="header">
      <div class="header-left">
        <span class="number">#{{ shortId }}</span>
        <UiTag
          v-if="currentStatus"
          size="small"
          :type="STATUS_GROUP_TAG_TYPES[currentStatus.groupType]"
        >{{ currentStatus.name }}</UiTag>
        <UiTag
          v-if="deliveryEnabled"
          size="small"
          :icon="order.deliveryType === 'delivery' ? 'bike' : undefined"
        >
          {{ DELIVERY_TYPE_LABELS[order.deliveryType] }}
        </UiTag>
        <UiTag v-if="branchName" size="tiny">{{ branchName }}</UiTag>
      </div>
      <div class="header-right">
        <span class="time">{{ relativeTime }}</span>
      </div>
    </div>

    <!-- Клиент -->
    <div class="customer">
      <span class="customer-name">{{ order.customer.name }}</span>
      <a :href="`tel:${order.customer.phone}`">{{ order.customer.phone }}</a>
    </div>

    <!-- Адрес -->
    <div v-if="deliveryEnabled && order.deliveryType === 'delivery' && order.address" class="address">
      <UiIcon name="mapPin" :size="14" /> {{ order.address }}
    </div>

    <!-- Состав -->
    <ul class="items">
      <li v-for="item in order.items" :key="item.dishId" class="item">
        <span class="item-name">{{ item.dishName }}</span>
        <span class="item-qty">× {{ item.quantity }}</span>
        <span class="item-price">{{ getItemUnitPrice(item) * item.quantity }} ₽</span>
      </li>
    </ul>

    <!-- Промокод / скидка -->
    <div v-if="order.discountAmount > 0" class="discount">
      <UiIcon name="promotions" :size="14" /> Скидка по промокоду <strong>{{ order.promoCode }}</strong>: −{{ order.discountAmount }} ₽
    </div>

    <!-- Комментарий -->
    <div v-if="order.comment" class="comment">
      <UiIcon name="messageCircle" :size="14" /> {{ order.comment }}
    </div>

    <!-- Итого + оплата -->
    <div class="footer">
      <div class="total-row">
        <span class="total-label">Итого</span>
        <span class="total">{{ order.total }} ₽</span>
        <span class="payment-type">
          <UiIcon :name="paymentIcon" :size="13" />
          {{ PAYMENT_TYPE_LABELS[order.paymentType] }}
        </span>
      </div>

    </div>

    <div v-if="quickActionStatuses.length" class="actions" @click.stop>
      <UiButton
        v-for="target in quickActionStatuses"
        :key="target.id"
        :type="STATUS_GROUP_TAG_TYPES[target.groupType]"
        ghost
        size="small"
        :disabled="updating"
        @click="emit('status-change', order.id, target.id)"
      >
        {{ target.name }}
      </UiButton>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiButton, UiCard, UiIcon, UiTag } from '@fastio/ui'
import type { Order, OrderStatus } from '@fastio/shared'
import { getItemUnitPrice } from '@fastio/shared'
import { STATUS_GROUP_TAG_TYPES, STATUS_GROUP_COLORS } from '~/config/order-status-groups'
import { DELIVERY_TYPE_LABELS, PAYMENT_TYPE_LABELS, PAYMENT_ICON_MAP } from '~/config/order-options'
import { formatRelativeTime } from '~/utils/formatRelativeTime'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { useTenantStore } from '~/stores/tenant'

const props = defineProps<{
  order: Order
  updating?: boolean
  branchName?: string
}>()

const emit = defineEmits<{
  'status-change': [id: string, statusId: string]
  'open-edit': [order: Order]
}>()

const { statuses } = useOrderStatusesStore()
const tenantStore = useTenantStore()
const deliveryEnabled = computed(() => tenantStore.tenant?.deliveryEnabled ?? true)

const shortId = computed(() => props.order.id.slice(0, 6).toUpperCase())

const currentStatus = computed(() => statuses.find((s) => s.id === props.order.status) ?? null,
)

const quickActionStatuses = computed(() => {
  const current = statuses.find((s) => s.id === props.order.status)

  if (!current?.quickActions?.length) return []

  return current.quickActions
    .map((id) => statuses.find((s) => s.id === id))
    .filter(Boolean) as OrderStatus[]
})

const paymentIcon = computed(() => PAYMENT_ICON_MAP[props.order.paymentType] ?? 'banknote')

const now = useNow({ interval: 30_000 })
const relativeTime = computed(() => formatRelativeTime(props.order.createdAt, now.value))
</script>

<style scoped lang="scss">
.card-root {
  gap: 10px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.number {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-title);
  font-variant-numeric: tabular-nums;
}

.time {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.customer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.customer-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-title);
}

.address {
  font-size: 13px;
  color: var(--color-text-hint);
  display: flex;
  align-items: center;
  gap: 4px;
}

.items {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 0;
  border-top: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
}

.item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-name {
  flex: 1;
  font-size: 13px;
  color: var(--grey-800);
}

.item-qty {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.item-price {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  min-width: 56px;
  text-align: right;
}

.discount,
.comment {
  font-size: 12px;
  color: var(--color-text-hint);
  display: flex;
  align-items: center;
  gap: 4px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.total-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.total-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.total {
  font-size: 17px;
  font-weight: 800;
  color: var(--color-title);
}

.payment-type {
  font-size: 11px;
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: 3px;
}

.actions {
  display: flex;
  gap: 6px;
  width: 100%;

  :deep(.n-button) {
    flex: 1;
  }
}
</style>
