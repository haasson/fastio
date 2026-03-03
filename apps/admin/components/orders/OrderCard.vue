<template>
  <div class="card-root" :class="{ new: order.status === 'new' }">
    <!-- Шапка -->
    <div class="header">
      <div class="header-left">
        <span class="number">#{{ shortId }}</span>
        <span class="delivery-badge" :class="order.deliveryType">
          <template v-if="order.deliveryType === 'delivery'"><UiIcon name="bike" :size="12" /> Доставка</template>
          <template v-else>Самовывоз</template>
        </span>
      </div>
      <div class="header-right">
        <span class="time">{{ relativeTime }}</span>
        <span class="status-badge" :style="{ background: statusCfg.color }">
          {{ statusCfg.label }}
        </span>
      </div>
    </div>

    <!-- Клиент -->
    <div class="customer">
      <span class="customer-name">{{ order.customer.name }}</span>
      <UiLink size="small" :href="`tel:${order.customer.phone}`">{{ order.customer.phone }}</UiLink>
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

      <!-- Кнопки действий -->
      <div v-if="order.status !== 'completed' && order.status !== 'cancelled'" class="actions">
        <UiButton
          v-if="next"
          type="primary"
          size="small"
          :disabled="updating"
          @click="advance"
        >
          {{ next.label }}
        </UiButton>
        <UiButton
          type="default"
          size="small"
          :disabled="updating"
          @click="$emit('cancel', order.id)"
        >
          Отменить
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiButton, UiLink, UiIcon } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { statusConfig, nextStatus, nextStatusPickup } from '~/config/order-statuses'

const props = defineProps<{
  order: Order
  updating?: boolean
}>()

const emit = defineEmits<{
  advance: [id: string, status: string]
  cancel: [id: string]
}>()

const shortId = computed(() => props.order.id.slice(0, 6).toUpperCase())

const statusCfg = computed(() => statusConfig[props.order.status])

const next = computed(() => {
  const map = props.order.deliveryType === 'pickup' ? nextStatusPickup : nextStatus

  return map[props.order.status] ?? null
})

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

// Относительное время
const now = useNow({ interval: 30_000 })
const relativeTime = computed(() => {
  const diff = now.value.getTime() - new Date(props.order.createdAt).getTime()
  const min = Math.floor(diff / 60_000)

  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)

  if (h < 24) return `${h} ч назад`

  return new Date(props.order.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
})

const advance = () => {
  if (next.value) emit('advance', props.order.id, next.value.status)
}
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
  transition: border-color 0.2s;

  &.new {
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

.delivery-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 4px;

  &.delivery {
    background: var(--blue-50);
    color: var(--blue-500);
  }

  &.pickup {
    background: var(--green-50);
    color: var(--green-500);
  }
}

.time {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-white);
  padding: 3px 8px;
  border-radius: 6px;
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
