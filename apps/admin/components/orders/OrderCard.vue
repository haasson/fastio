<template>
  <div class="card-root" :class="{ new: order.status === 'new' }">
    <!-- Шапка -->
    <div class="header">
      <div class="header-left">
        <span class="number">#{{ shortId }}</span>
        <span class="delivery-badge" :class="order.deliveryType">
          {{ order.deliveryType === 'delivery' ? '🚴 Доставка' : '🏃 Самовывоз' }}
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
      📍 {{ order.address }}
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
      🎁 Скидка по промокоду <strong>{{ order.promoCode }}</strong>: −{{ order.discountAmount }} ₽
    </div>

    <!-- Комментарий -->
    <div v-if="order.comment" class="comment">
      💬 {{ order.comment }}
    </div>

    <!-- Итого + оплата -->
    <div class="footer">
      <div class="total-row">
        <span class="total-label">Итого</span>
        <span class="total">{{ order.total }} ₽</span>
        <span class="payment-type">{{ paymentLabel }}</span>
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
        <UiButton type="tertiary" size="small" :disabled="updating" @click="$emit('cancel', order.id)">
          Отменить
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiButton, UiLink } from '@fastfood-saas/ui'
import type { Order } from '@fastfood-saas/shared'
import { nextStatus, nextStatusPickup, statusConfig } from '~/composables/useOrders'

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

const paymentLabel: Record<string, string> = {
  cash: '💵 Наличные',
  card: '💳 Карта при получении',
  online: '📱 Онлайн',
}

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

function advance() {
  if (next.value) emit('advance', props.order.id, next.value.status)
}
</script>

<style scoped lang="scss">
.card-root {
  background: #fff;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 2px solid transparent;
  transition: border-color 0.2s;

  &.new {
    border-color: #3b82f6;
    animation: pulse-border 2s ease-in-out infinite;
  }
}

@keyframes pulse-border {
  0%, 100% {
    border-color: #3b82f6;
  }

  50% {
    border-color: #93c5fd;
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
  color: #111;
  font-variant-numeric: tabular-nums;
}

.delivery-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;

  &.delivery {
    background: #eff6ff;
    color: #3b82f6;
  }

  &.pickup {
    background: #f0fdf4;
    color: #16a34a;
  }
}

.time {
  font-size: 12px;
  color: #aaa;
}

.status-badge {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
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
  color: #111;
}

.address {
  font-size: 13px;
  color: #555;
}

.items {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 0;
  border-top: 1px solid #f5f5f5;
  border-bottom: 1px solid #f5f5f5;
}

.item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-name {
  flex: 1;
  font-size: 13px;
  color: #333;
}

.item-qty {
  font-size: 12px;
  color: #aaa;
}

.item-price {
  font-size: 13px;
  font-weight: 600;
  color: #111;
  min-width: 56px;
  text-align: right;
}

.discount,
.comment {
  font-size: 12px;
  color: #666;
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
  color: #999;
}

.total {
  font-size: 17px;
  font-weight: 800;
  color: #111;
}

.payment-type {
  font-size: 11px;
  color: #aaa;
}

.actions {
  display: flex;
  gap: 6px;
}
</style>
