<template>
  <UiCard
    clickable
    class="card-root"
    :style="currentStatus ? { outline: `1px solid ${STATUS_GROUP_COLORS[currentStatus.groupType]}` } : undefined"
    @click="emit('open-edit', order)"
  >
    <!-- Шапка -->
    <div class="header">
      <div class="header-top">
        <span class="number">{{ order.orderNumber }}</span>
        <UiTag
          v-if="currentStatus"
          size="small"
          round
          :type="STATUS_GROUP_TAG_TYPES[currentStatus.groupType]"
        >{{ currentStatus.name }}</UiTag>
        <span class="time" :title="absoluteTime">{{ relativeTime }}</span>
      </div>
      <div v-if="order.scheduledAt || showDeliveryType || branchName" class="header-meta">
        <UiTag
          v-if="order.scheduledAt"
          size="small"
          type="warning"
          empty
          round
          icon="clock"
        >{{ scheduledLabel }}</UiTag>
        <UiTag
          v-if="showDeliveryType"
          size="small"
          :type="order.deliveryType === 'delivery' ? 'primary' : 'success'"
          empty
          round
          :icon="(DELIVERY_TYPE_ICONS[order.deliveryType] as IconName | undefined)"
        >
          {{ order.tableName ?? DELIVERY_TYPE_LABELS[order.deliveryType] }}
        </UiTag>
        <UiTag
          v-if="branchName"
          size="small"
          type="primary"
          empty
          round
          icon="mapPin"
        >{{ branchName }}</UiTag>
      </div>
    </div>

    <!-- Клиент -->
    <div class="customer">
      <span class="customer-name">{{ order.customerName || 'Гость' }}</span>
      <a :href="`tel:${order.customerPhone}`" @click.stop>{{ formatPhone(order.customerPhone) }}</a>
    </div>

    <!-- Адрес -->
    <div v-if="order.deliveryType === 'delivery' && order.address" class="address">
      <UiIcon name="mapPin" :size="14" />
      <span class="address-text">{{ order.address }}{{ order.apartment ? `, кв. ${order.apartment}` : '' }}</span>
    </div>

    <!-- Состав -->
    <div class="items-section">
      <span class="items-label">Состав · {{ order.items.length }} поз.</span>
      <ul class="items">
        <li v-for="(item, i) in visibleItems" :key="item.id ?? i" class="item">
          <span class="item-name">{{ item.dishName }}</span>
          <span class="item-qty">× {{ item.quantity }}</span>
          <span class="item-price">{{ getItemUnitPrice(item) * item.quantity }} ₽</span>
        </li>
        <li v-if="hiddenItemsCount > 0" class="item-more">+{{ hiddenItemsCount }} ещё</li>
      </ul>
    </div>

    <!-- Промокод / скидка -->
    <div v-if="order.discountAmount > 0" class="discount">
      <UiIcon name="promotions" :size="14" />
      <template v-if="order.promoCode">Промокод <strong>{{ order.promoCode }}</strong></template>
      <template v-else>Акция</template>
      : −{{ order.discountAmount }} ₽
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
      </div>
      <span class="payment-type">
        <UiIcon :name="paymentIcon" :size="13" />
        {{ PAYMENT_TYPE_LABELS[order.paymentType] }}
        <template v-if="order.needsChange && order.paymentType === 'cash'">
          · сдача с {{ order.changeFrom }} ₽
        </template>
      </span>
    </div>

    <div
      v-if="quickActionStatuses.length"
      class="actions"
      data-tour="order-quick-actions"
      @click.stop
    >
      <UiButton
        v-for="target in quickActionStatuses"
        :key="target.id"
        class="action-btn"
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
import { computed, toRef } from 'vue'
import { UiButton, UiCard, UiIcon, UiTag } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { getItemUnitPrice, formatPhone, utcIsoToLocalDateTime, todayInTz, addDaysToDateStr } from '@fastio/shared'
import { STATUS_GROUP_TAG_TYPES, STATUS_GROUP_COLORS } from '~/config/retail/order-status-groups'
import type { IconName } from '@fastio/icons'
import { DELIVERY_TYPE_LABELS, DELIVERY_TYPE_ICONS, PAYMENT_TYPE_LABELS, PAYMENT_ICON_MAP } from '~/config/retail/order-options'
import { useOrderCard } from '../composables/useOrderCard'
import { useTenantStore } from '~/shared/stores/tenant'
import { useGate } from '~/shared/plan/useGate'

const props = defineProps<{
  order: Order
  updating?: boolean
  branchName?: string
}>()

const emit = defineEmits<{
  'status-change': [id: string, statusId: string]
  'open-edit': [order: Order]
}>()

const { currentStatus, quickActionStatuses, relativeTime }
  = useOrderCard(toRef(props, 'order'))

const tenantStore = useTenantStore()
const gate = useGate()
const showDeliveryType = computed(() => gate.delivery.value.enabled && gate.pickup.value.enabled)

const paymentIcon = computed(() => PAYMENT_ICON_MAP[props.order.paymentType] ?? 'banknote')

const MAX_ITEMS = 3
const visibleItems = computed(() => props.order.items.slice(0, MAX_ITEMS))
const hiddenItemsCount = computed(() => Math.max(0, props.order.items.length - MAX_ITEMS))

const absoluteTime = computed(() => {
  const d = new Date(props.order.createdAt)

  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
})

const scheduledLabel = computed(() => {
  if (!props.order.scheduledAt) return ''
  const tz = tenantStore.timezone
  const { dateStr, timeStr } = utcIsoToLocalDateTime(props.order.scheduledAt, tz)
  const today = todayInTz(tz)
  const tomorrow = addDaysToDateStr(today, 1)

  if (dateStr === today) return `Сегодня ${timeStr}`
  if (dateStr === tomorrow) return `Завтра ${timeStr}`

  return `${dateStr.slice(8)}.${dateStr.slice(5, 7)} ${timeStr}`
})
</script>

<style scoped lang="scss">
.card-root {
  gap: var(--space-8);
}

.header {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.header-top {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;

  .time {
    margin-left: auto;
    flex-shrink: 0;
  }
}

.header-meta {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.number {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-title);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.time {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: default;
}

.customer {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.customer-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
}

.address {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  overflow: hidden;
}

.address-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.items-section {
  border-top: 1px solid var(--color-border-light);
  border-bottom: 1px solid var(--color-border-light);
  padding: var(--space-8) 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.items-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.items {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.item-name {
  flex: 1;
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.item-qty {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.item-price {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
  min-width: 70px;
  text-align: right;
}

.item-more {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.discount,
.comment {
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.discount {
  color: var(--color-text-secondary);
}

.comment {
  color: var(--color-text-secondary);
  font-style: italic;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  margin-top: var(--space-4);
}

.total-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.total-label {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
}

.total {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-title);
}

.payment-type {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.actions {
  display: flex;
  gap: var(--space-8);
  width: 100%;
}

:deep(.action-btn) {
  flex: 1;
}
</style>
