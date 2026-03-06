<template>
  <div class="card-root" :class="{ 'is-new': currentStatus?.groupType === 'new' }" @click="emit('open-edit', order)">
    <!-- Шапка -->
    <div class="header">
      <div class="header-left">
        <span class="number">#{{ shortId }}</span>
        <UiTag
          :type="order.deliveryType === 'delivery' ? 'primary' : 'success'"
          secondary
          size="tiny"
          :icon="order.deliveryType === 'delivery' ? 'bike' : undefined"
        >
          {{ order.deliveryType === 'delivery' ? 'Доставка' : 'Самовывоз' }}
        </UiTag>
        <UiTag v-if="branchName" size="tiny">{{ branchName }}</UiTag>
      </div>
      <div class="header-right">
        <span class="time">{{ relativeTime }}</span>
        <UiTag
          v-if="currentStatus"
          size="tiny"
          :type="STATUS_GROUP_TAG_TYPES[currentStatus.groupType]"
        >{{ currentStatus.name }}</UiTag>
      </div>
    </div>

    <!-- Клиент -->
    <div class="customer">
      <span class="customer-name">{{ order.customer.name }}</span>
      <a :href="`tel:${order.customer.phone}`">{{ order.customer.phone }}</a>
    </div>

    <!-- Адрес -->
    <div v-if="order.deliveryType === 'delivery' && order.address" class="address">
      <UiIcon name="mapPin" :size="14" /> {{ order.address }}
    </div>

    <!-- Состав -->
    <ul class="items">
      <li v-for="item in order.items" :key="item.dishId" class="item">
        <span class="item-name">{{ item.dishName }}</span>
        <span class="item-qty">× {{ item.quantity }}</span>
        <span class="item-price">{{ item.price * item.quantity }} ₽</span>
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
          {{ paymentLabel[order.paymentType] }}
        </span>
      </div>

      <!-- Смена статуса -->
      <div v-if="statuses.length" class="actions" @click.stop>
        <UiMenuDropdown
          :items="statusMenuItems"
          trigger="click"
          compact
          @item-click="onStatusSelect"
        >
          <template #trigger>
            <UiButton type="default" size="small" :disabled="updating">
              Сменить статус
            </UiButton>
          </template>
        </UiMenuDropdown>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiButton, UiIcon, UiMenuDropdown, UiTag, COLORS } from '@fastio/ui'
import type { Order, OrderStatus } from '@fastio/shared'
import { STATUS_GROUP_COLORS, STATUS_GROUP_TAG_TYPES } from '~/config/order-status-groups'
import { formatRelativeTime } from '~/utils/formatRelativeTime'

const props = defineProps<{
  order: Order
  updating?: boolean
  branchName?: string
  statuses: OrderStatus[]
}>()

const emit = defineEmits<{
  'status-change': [id: string, statusId: string]
  'open-edit': [order: Order]
}>()

const shortId = computed(() => props.order.id.slice(0, 6).toUpperCase())

const currentStatus = computed(() => props.statuses.find((s) => s.id === props.order.status) ?? null,
)

const statusColor = computed(() => currentStatus.value ? STATUS_GROUP_COLORS[currentStatus.value.groupType] : COLORS.GREY_500,
)

const statusMenuItems = computed(() => props.statuses
  .filter((s) => s.id !== props.order.status)
  .map((s) => ({
    name: s.id,
    label: s.name,
    color: STATUS_GROUP_COLORS[s.groupType],
  })),
)

const onStatusSelect = (statusId: string) => {
  emit('status-change', props.order.id, statusId)
}

const paymentIconMap: Record<string, 'banknote' | 'creditCard' | 'smartphone'> = {
  cash: 'banknote',
  card: 'creditCard',
  online: 'smartphone',
}

const paymentLabel: Record<string, string> = {
  cash: 'Наличные',
  card: 'Карта при получении',
  online: 'Онлайн',
}

const paymentIcon = computed(
  () => paymentIconMap[props.order.paymentType] ?? 'banknote',
)

const now = useNow({ interval: 30_000 })
const relativeTime = computed(() => formatRelativeTime(props.order.createdAt, now.value))
</script>

<style scoped lang="scss">
.card-root {
  background: var(--color-bg-card);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 2px solid transparent;
  transition: border-color 0.2s, background 0.12s;
  cursor: pointer;

  &:hover {
    background: var(--color-bg-card-hover, var(--color-bg-card));
  }

  &.is-new {
    border-color: var(--blue-500);
    animation: pulse-border 2s ease-in-out infinite;
  }
}

@keyframes pulse-border {
  0%, 100% {
    border-color: var(--blue-500);
  }

  50% {
    border-color: var(--blue-200);
  }
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
}
</style>
