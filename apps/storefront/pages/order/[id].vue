<template>
  <PageShell>
    <div class="order-root">
      <div v-if="pending && !order" class="order-loading">
        <FsSpinner size="large" />
        Загружаем заказ...
      </div>

      <div v-else-if="!pending && !order" class="order-not-found">
        <SfEmptyState title="Заказ не найден" description="Возможно, ссылка устарела">
          <SearchX />
          <template #action>
            <FsButton @click="navigateTo('/')">На главную</FsButton>
          </template>
        </SfEmptyState>
      </div>

      <div v-else-if="order" class="order-content">
        <!-- Header -->
        <div class="order-header">
          <template v-if="isFresh">
            <div class="success-icon"><CircleCheck :size="32" /></div>
            <FsHeading as="h3" class="order-title">Заказ принят!</FsHeading>
            <FsText as="p" variant="body-sm" color="secondary" class="order-subtitle">
              Ожидайте звонка для подтверждения
            </FsText>
          </template>
          <template v-else>
            <FsHeading as="h3" class="order-title">Заказ #{{ order.orderNumber }}</FsHeading>
            <FsText as="p" variant="body-sm" color="secondary" class="order-subtitle">
              {{ formatDate(order.createdAt) }}
            </FsText>
          </template>
          <div class="order-meta">
            <span v-if="isFresh" class="order-id">Заказ #{{ order.orderNumber }}</span>
            <SfOrderStatus :group="statusGroup" />
          </div>
        </div>

        <!-- Order details card -->
        <FsCard class="order-card">
          <div class="order-card-body">
          <FsHeading as="h6">Ваш заказ</FsHeading>

          <SfOrderItemsList :items="order.items" :currency="currency" />

          <FsDivider spacing="none" />

          <SfOrderTotals
            :subtotal="order.subtotal"
            :delivery-fee="order.deliveryFee"
            :discount-amount="order.discountAmount"
            :total="order.total"
            :currency="currency"
          />
          </div>
        </FsCard>

        <!-- Delivery info -->
        <FsCard>
          <div class="order-info">
            <div v-if="order.address" class="info-row">
              <span class="info-label">Адрес</span>
              <span class="info-value">{{ order.address }}</span>
            </div>
            <div v-if="order.deliveryType === 'pickup'" class="info-row">
              <span class="info-label">Самовывоз</span>
              <span class="info-value">{{ order.branchAddress || 'Самовывоз' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Оплата</span>
              <span class="info-value">{{ paymentLabel }}</span>
            </div>
          </div>
        </FsCard>

        <FsButton variant="secondary" size="large" class="back-btn" @click="navigateTo('/')">
          Вернуться в {{ menu.acc }}
        </FsButton>
      </div>
    </div>
  </PageShell>
</template>

<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import { useRoute, useFetch, navigateTo } from 'nuxt/app'
import { SearchX, CircleCheck } from 'lucide-vue-next'
import type { Order } from '@fastio/shared'
import { formatDateTime } from '@fastio/shared'
import { useCurrency } from '~/composables/useCurrency'
import { useStorefrontTerms } from '~/composables/useStorefrontTerms'
import PageShell from '~/components/sections/PageShell.vue'
import { FsHeading, FsButton, FsCard, FsText, FsDivider, FsSpinner } from '@fastio/public-ui'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import SfOrderStatus from '~/components/sf/domain/SfOrderStatus.vue'
import SfOrderTotals from '~/components/sf/domain/SfOrderTotals.vue'
import SfOrderItemsList from '~/components/sf/domain/SfOrderItemsList.vue'

const { menu } = useStorefrontTerms()
const route = useRoute()
const currency = useCurrency()

const { data: order, pending, refresh } = await useFetch<Order>(`/api/orders/${route.params.id}`, {
  query: route.query.slug ? { slug: route.query.slug } : {},
})

const statusGroup = computed(() => order.value?.statusGroup ?? 'new')

const isFinished = computed(() => statusGroup.value === 'completed' || statusGroup.value === 'cancelled')

// Свежий заказ — не завершён, создан меньше суток назад
const isFresh = computed(() => {
  if (!order.value) return false
  if (isFinished.value) return false
  const age = Date.now() - new Date(order.value.createdAt).getTime()
  return age < 24 * 60 * 60 * 1000
})

const formatDate = formatDateTime

// Polling: refresh order status every 15s if not finished
let pollTimer: ReturnType<typeof setInterval> | null = null

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
  color: var(--color-text-secondary);
  @include text-caption;
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
  @include text-xs;
  color: var(--color-text-secondary);
  font-family: monospace;
}

// Card (FsCard handles border/bg/radius)
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
  @include text-caption;
}

.info-label {
  color: var(--color-text-secondary);
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
