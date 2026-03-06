<template>
  <div class="page-root">
    <TheHeader v-if="tenant" :tenant="tenant" />

    <main class="main">
      <div class="container">
        <div v-if="pending" class="state-msg">Загрузка…</div>
        <div v-else-if="error" class="state-msg error">Заказ не найден</div>

        <div v-else-if="order" class="order-card">
          <!-- Статус -->
          <div class="status-block" :style="{ '--status-color': statusCfg.color }">
            <span class="status-icon">{{ statusCfg.icon }}</span>
            <div>
              <p class="status-label">{{ statusCfg.label }}</p>
              <p class="status-desc">{{ statusCfg.desc }}</p>
            </div>
          </div>

          <!-- Прогресс -->
          <div class="progress">
            <div
              v-for="(step, i) in steps"
              :key="step.status"
              class="step"
              :class="{
                done: stepIndex >= i,
                active: stepIndex === i,
                cancelled: false,
              }"
            >
              <div class="step-dot" />
              <span class="step-label">{{ step.label }}</span>
            </div>
            <div class="progress-line" :style="{ width: progressWidth }" />
          </div>

          <!-- Детали -->
          <div class="details">
            <div class="detail-row">
              <span class="detail-key">Номер заказа</span>
              <span class="detail-val">#{{ order.id.slice(0, 6).toUpperCase() }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-key">Клиент</span>
              <span class="detail-val">{{ order.customer.name }}, {{ order.customer.phone }}</span>
            </div>
            <div v-if="order.address" class="detail-row">
              <span class="detail-key">Адрес</span>
              <span class="detail-val">{{ order.address }}</span>
            </div>
          </div>

          <!-- Состав -->
          <ul class="items">
            <li v-for="item in order.items" :key="item.dishId" class="item">
              <span class="item-name">{{ item.dishName }}</span>
              <span class="item-qty">× {{ item.quantity }}</span>
              <span class="item-price">{{ item.price * item.quantity }} ₽</span>
            </li>
          </ul>

          <div class="total-row">
            <span class="total-label">Итого</span>
            <span class="total">{{ order.total }} ₽</span>
          </div>

          <NuxtLink class="btn-back" to="/">← Вернуться в меню</NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { Tenant, Order } from '@fastio/shared'

const route = useRoute()
const rfetch = useRequestFetch()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}

const { data: tenant } = await useAsyncData<Tenant>('tenant', () => rfetch('/api/tenant', slugQuery))

const { data: order, pending, error, refresh } = await useAsyncData<Order>(
  `order-${route.params.id}`,
  () => rfetch(`/api/orders/${route.params.id}`, slugQuery),
)

// Опрашиваем статус каждые 15 секунд
useIntervalFn(() => {
  if (order.value) refresh()
}, 15_000)

useHead({ title: `Заказ #${String(route.params.id).slice(0, 6).toUpperCase()}` })

const steps = [
  { label: 'Принят' },
  { label: 'Готовится' },
  { label: 'Готов' },
  { label: 'Доставляется' },
  { label: 'Доставлен' },
]

// Прогресс статичен — статусы теперь кастомные, отображаем фиксированные шаги визуально
const stepIndex = computed(() => 0)

const progressWidth = computed(() => '0%')

const statusCfg = computed(() => ({
  label: 'Заказ оформлен',
  desc: 'Статус обновится в ближайшее время',
  icon: '📋',
  color: '#3b82f6',
}))
</script>

<style scoped lang="scss">
.page-root {
  min-height: 100vh;
  background: #f7f7f8;
}

.main {
  padding: 32px 0 60px;
}

.container {
  max-width: 560px;
  margin: 0 auto;
  padding: 0 20px;
}

.state-msg {
  text-align: center;
  padding: 60px 0;
  color: #bbb;
  font-size: 16px;

  &.error {
    color: #e53935;
  }
}

.order-card {
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.status-block {
  padding: 24px 24px 20px;
  background: color-mix(in srgb, var(--status-color) 8%, white);
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-icon {
  font-size: 36px;
}

.status-label {
  font-size: 18px;
  font-weight: 800;
  color: #111;
  margin-bottom: 2px;
}

.status-desc {
  font-size: 13px;
  color: #888;
}

.progress {
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  position: relative;
  border-bottom: 1px solid #f5f5f5;
}

.progress-line {
  position: absolute;
  top: 29px;
  left: 24px;
  height: 2px;
  background: var(--primary);
  transition: width 0.5s ease;
  right: 24px;
  width: 0;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1;

  &.done .step-dot {
    background: var(--primary);
  }

  &.active .step-dot {
    background: var(--primary);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, white);
  }

  &.cancelled .step-dot {
    background: #ef4444;
  }

  &.done .step-label {
    color: var(--primary);
  }
}

.step-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #e0e0e0;
  border: 2px solid #fff;
  transition: background 0.3s;
}

.step-label {
  font-size: 10px;
  color: #bbb;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.details {
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid #f5f5f5;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.detail-key {
  font-size: 13px;
  color: #999;
}

.detail-val {
  font-size: 13px;
  font-weight: 600;
  color: #111;
  text-align: right;
}

.items {
  list-style: none;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid #f5f5f5;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-name {
  flex: 1;
  font-size: 14px;
  color: #333;
}

.item-qty {
  font-size: 13px;
  color: #aaa;
}

.item-price {
  font-size: 14px;
  font-weight: 600;
  color: #111;
  min-width: 60px;
  text-align: right;
}

.total-row {
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid #f5f5f5;
}

.total-label {
  font-size: 14px;
  color: #999;
}

.total {
  font-size: 20px;
  font-weight: 800;
  color: #111;
}

.btn-back {
  margin: 16px 24px 24px;
  font-size: 14px;
  color: var(--primary);
  align-self: flex-start;

  &:hover {
    text-decoration: underline;
  }
}
</style>
