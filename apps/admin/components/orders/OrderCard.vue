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
        <span class="number">#{{ shortId }}</span>
        <UiTag
          v-if="currentStatus"
          size="small"
          round
          :type="STATUS_GROUP_TAG_TYPES[currentStatus.groupType]"
        >{{ currentStatus.name }}</UiTag>
        <UiTag
          size="small"
          :type="order.deliveryType === 'delivery' ? 'primary' : 'success'"
          empty
          round
          :icon="(DELIVERY_TYPE_ICONS[order.deliveryType] as IconName | undefined)"
        >
          {{ order.tableName ?? DELIVERY_TYPE_LABELS[order.deliveryType] }}
        </UiTag>
        <span class="time" :title="absoluteTime">{{ relativeTime }}</span>
      </div>
      <div v-if="branchName" class="header-tags">
        <UiTag
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
      <span class="address-text">{{ order.address }}</span>
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
      </div>
      <span class="payment-type">
        <UiIcon :name="paymentIcon" :size="13" />
        {{ PAYMENT_TYPE_LABELS[order.paymentType] }}
      </span>
    </div>

    <div v-if="quickActionStatuses.length" class="actions" @click.stop>
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
import { getItemUnitPrice, formatPhone } from '@fastio/shared'
import { STATUS_GROUP_TAG_TYPES, STATUS_GROUP_COLORS } from '~/config/order-status-groups'
import type { IconName } from '@fastio/icons'
import { DELIVERY_TYPE_LABELS, DELIVERY_TYPE_ICONS, PAYMENT_TYPE_LABELS, PAYMENT_ICON_MAP } from '~/config/order-options'
import { useOrderCard } from '~/composables/ui/useOrderCard'

const props = defineProps<{
  order: Order
  updating?: boolean
  branchName?: string
}>()

const emit = defineEmits<{
  'status-change': [id: string, statusId: string]
  'open-edit': [order: Order]
}>()

const { shortId, currentStatus, quickActionStatuses, relativeTime }
  = useOrderCard(toRef(props, 'order'))

const paymentIcon = computed(() => PAYMENT_ICON_MAP[props.order.paymentType] ?? 'banknote')

const MAX_ITEMS = 3
const visibleItems = computed(() => props.order.items.slice(0, MAX_ITEMS))
const hiddenItemsCount = computed(() => Math.max(0, props.order.items.length - MAX_ITEMS))

const absoluteTime = computed(() => {
  const d = new Date(props.order.createdAt)

  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
})
</script>

<style scoped lang="scss">
.card-root {
  gap: 10px;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.header-top {
  display: flex;
  align-items: center;
  gap: 8px;

  .time {
    margin-left: auto;
  }
}

.header-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
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
  cursor: default;
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
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.items-label {
  font-size: 11px;
  color: var(--color-text-hint);
}

.items {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
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
  min-width: 70px;
  text-align: right;
}

.item-more {
  font-size: 12px;
  color: var(--color-text-hint);
}

.discount,
.comment {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.discount {
  color: var(--color-text-hint);
}

.comment {
  color: var(--color-text-secondary);
  font-style: italic;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
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
}

:deep(.action-btn) {
  flex: 1;
}
</style>
