<template>
  <PageShell>
    <FsSection>
      <StorePageLayout back-to="/" back-label="Главная">
        <template #heading>Мои заказы</template>

        <div class="orders-root">
          <AccountCardsSkeleton
            v-if="loading"
            :count="3"
            :lines="[{ width: '30%', height: '18px' }, { width: '55%', height: '13px' }]"
          />

          <SfEmptyState
            v-else-if="orders.length === 0"
            title="У вас пока нет заказов"
            description="Оформите первый заказ — он появится здесь"
          >
            <ShoppingBag />
            <template #action>
              <FsButton variant="primary" @click="navigateTo({ path: '/', query: route.query })">Перейти в меню</FsButton>
            </template>
          </SfEmptyState>

          <div v-else class="orders-list">
            <FsCard v-for="order in orders" :key="order.id" class="order-card" @click="goToOrder(order.id)">
              <div class="order-inner">
                <div class="order-left">
                  <div class="order-header">
                    <span class="order-number">#{{ order.orderNumber }}</span>
                    <span class="order-total">{{ order.total }} {{ currency }}</span>
                  </div>
                  <span class="order-meta">{{ formatDate(order.createdAt) }} · {{ order.items.length }} {{ itemsLabel(order.items.length) }}</span>
                </div>
                <div class="order-right">
                  <SfOrderStatus :group="order.statusGroup ?? 'new'" size="sm" />
                  <ChevronRight :size="16" class="order-arrow" />
                </div>
              </div>
            </FsCard>

            <FsButton
              v-if="hasMore"
              variant="outline"
              block
              :disabled="loadingMore"
              @click="loadMore"
            >
              {{ loadingMore ? 'Загрузка...' : 'Показать ещё' }}
            </FsButton>
          </div>
        </div>
      </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { navigateTo, useRoute } from 'nuxt/app'
import type { Order } from '@fastio/shared'
import { pluralize } from '@fastio/shared'
import { ShoppingBag, ChevronRight } from 'lucide-vue-next'
import { FsSection, FsCard, FsButton } from '@fastio/public-ui'
import AccountCardsSkeleton from '~/components/account/AccountCardsSkeleton.vue'
import SfOrderStatus from '~/components/sf/domain/SfOrderStatus.vue'
import PageShell from '~/components/sections/PageShell.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'
import { useAuthStore } from '~/stores/auth'
import { useSupabaseClient } from '~/composables/useSupabaseClient'
import { useCurrency } from '~/composables/useCurrency'
import { storeToRefs } from 'pinia'

const route = useRoute()
const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)
const currency = useCurrency()

const orders = ref<Order[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const total = ref(0)
const page = ref(1)
const limit = 20

const hasMore = computed(() => orders.value.length < total.value)

onMounted(async () => {
  await authStore.init()
  if (!isAuthenticated.value) {
    authStore.showLogin()
    navigateTo('/')
    return
  }
  await fetchOrders()
})

async function fetchOrders() {
  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const result = await $fetch<{ orders: Order[]; total: number }>('/api/customer/orders', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    params: { page: page.value, limit },
  })
  orders.value = result.orders
  total.value = result.total
  loading.value = false
}

async function loadMore() {
  loadingMore.value = true
  page.value++

  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const result = await $fetch<{ orders: Order[]; total: number }>('/api/customer/orders', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    params: { page: page.value, limit },
  })
  orders.value.push(...result.orders)
  loadingMore.value = false
}

function goToOrder(id: string) {
  navigateTo({ path: `/order/${id}`, query: route.query })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function itemsLabel(n: number) {
  return pluralize(n, 'позиция', 'позиции', 'позиций')
}

</script>

<style scoped lang="scss">
.orders-root {
  max-width: 600px;
  margin: 0 auto;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-card {
  cursor: pointer;
}

.order-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
}

.order-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.order-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.order-number {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  font-family: monospace;
}

.order-total {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-text);
}

.order-meta {
  font-size: 13px;
  color: var(--color-text-muted);
}

.order-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.order-arrow {
  color: var(--color-text-muted);
}
</style>
