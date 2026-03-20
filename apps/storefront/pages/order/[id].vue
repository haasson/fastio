<template>
  <PageShell>
    <div class="order-root">
      <div v-if="pending && !order" class="order-loading">
        <SfSpinner size="large" />
        Загружаем заказ...
      </div>

      <div v-else-if="!pending && !order" class="order-not-found">
        <SfEmptyState title="Заказ не найден" description="Возможно, ссылка устарела">
          <SearchX />
          <template #action>
            <SfButton @click="navigateTo('/')">На главную</SfButton>
          </template>
        </SfEmptyState>
      </div>

      <div v-else class="order-content">
        <!-- Header -->
        <div class="order-header">
          <div class="success-icon"><CircleCheck :size="32" /></div>
          <SfHeading as="h3" class="order-title">Заказ принят!</SfHeading>
          <SfText as="p" variant="body-sm" color="secondary" class="order-subtitle">
            Ожидайте звонка для подтверждения
          </SfText>
          <div class="order-meta">
            <span class="order-id">Заказ #{{ order.id.slice(0, 8) }}</span>
            <SfOrderStatus :group="statusGroup" :label="order.statusName ?? undefined" />
          </div>
        </div>

        <!-- Order details card -->
        <SfCard class="order-card">
          <div class="order-card-body">
          <SfHeading as="h6">Ваш заказ</SfHeading>

          <SfOrderItemsList :items="order.items" :currency="currency" />

          <SfDivider spacing="none" />

          <SfOrderTotals
            :subtotal="order.subtotal"
            :delivery-fee="order.deliveryFee"
            :discount-amount="order.discountAmount"
            :total="order.total"
            :currency="currency"
          />
          </div>
        </SfCard>

        <!-- Delivery info -->
        <SfCard>
          <div class="order-info">
            <div v-if="order.address" class="info-row">
              <span class="info-label">Адрес</span>
              <span class="info-value">{{ order.address }}</span>
            </div>
            <div v-if="order.deliveryType === 'pickup'" class="info-row">
              <span class="info-label">Получение</span>
              <span class="info-value">Самовывоз</span>
            </div>
            <div class="info-row">
              <span class="info-label">Оплата</span>
              <span class="info-value">{{ paymentLabel }}</span>
            </div>
          </div>
        </SfCard>

        <SfButton variant="secondary" size="large" class="back-btn" @click="navigateTo('/')">
          Вернуться в меню
        </SfButton>
      </div>
    </div>
  </PageShell>
</template>

<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import { useRoute, useFetch, navigateTo } from 'nuxt/app'
import { SearchX, CircleCheck } from 'lucide-vue-next'
import type { Order } from '@fastio/shared'
import { useCurrency } from '~/composables/useCurrency'
import PageShell from '~/components/sections/PageShell.vue'
import SfHeading from '~/components/sf/typography/SfHeading.vue'
import SfButton from '~/components/sf/base/SfButton.vue'
import SfCard from '~/components/sf/layout/SfCard.vue'
import SfText from '~/components/sf/typography/SfText.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import SfOrderStatus from '~/components/sf/domain/SfOrderStatus.vue'
import SfOrderTotals from '~/components/sf/domain/SfOrderTotals.vue'
import SfOrderItemsList from '~/components/sf/domain/SfOrderItemsList.vue'
import SfDivider from '~/components/sf/base/SfDivider.vue'
import SfSpinner from '~/components/sf/base/SfSpinner.vue'

const route = useRoute()
const currency = useCurrency()

const { data: order, pending, refresh } = await useFetch<Order>(`/api/orders/${route.params.id}`)

const statusGroup = computed(() => order.value?.statusGroup ?? 'new')

// Polling: refresh order status every 15s if not finished
let pollTimer: ReturnType<typeof setInterval> | null = null

const isFinished = computed(() => {
  const g = statusGroup.value
  return g === 'completed' || g === 'cancelled'
})

if (import.meta.client) {
  pollTimer = setInterval(async () => {
    if (isFinished.value) {
      if (pollTimer) clearInterval(pollTimer)
      pollTimer = null
      return
    }
    await refresh()
  }, 15_000)
}

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

const paymentLabel = computed(() => {
  if (!order.value) return ''
  const map: Record<string, string> = {
    card: 'Картой при получении',
    cash: 'Наличными',
    online: 'Онлайн',
  }
  return map[order.value.paymentType] ?? order.value.paymentType
})

</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.order-root {
  max-width: 600px;
  margin: 0 auto;
  padding: 32px 16px 80px;

  @include md {
    padding: 48px 24px 80px;
  }
}

.order-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 64px 0;
  color: var(--color-text-muted);
  font-size: 14px;
}

.order-not-found {
  padding: 64px 0;
}

.order-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.order-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 24px 0;
}

.success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.order-subtitle {
  color: var(--color-text-secondary);
}

.order-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.order-id {
  font-size: 13px;
  color: var(--color-text-muted);
  font-family: monospace;
}

// Card (SfCard handles border/bg/radius)
.order-card-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-info {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-row {
  display: flex;
  gap: 12px;
  font-size: 14px;
}

.info-label {
  color: var(--color-text-muted);
  min-width: 80px;
  flex-shrink: 0;
}

.info-value {
  color: var(--color-text);
}

.back-btn {
  width: 100%;
}
</style>
