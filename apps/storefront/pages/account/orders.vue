<template>
  <PageShell>
    <FsSection>
      <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }, { label: 'Личный кабинет', to: '/account' }]" current="Мои заказы">

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
              <FsButton variant="primary" @click="navigateTo({ path: '/', query: route.query })">Перейти в {{ menu.acc }}</FsButton>
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
import { pluralize, formatDateTime } from '@fastio/shared'
import { ShoppingBag, ChevronRight } from 'lucide-vue-next'
import { FsSection, FsCard, FsButton } from '@fastio/public-ui'
import { useStorefrontTerms } from '~/shared/composables/useStorefrontTerms'
import AccountCardsSkeleton from '~/features/account/components/AccountCardsSkeleton.vue'
import SfOrderStatus from '~/shared/ui/sf/domain/SfOrderStatus.vue'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import StorePageLayout from '~/shared/ui/layout/StorePageLayout.vue'
import SfEmptyState from '~/shared/ui/sf/domain/SfEmptyState.vue'
import { useAuthStore } from '~/features/auth'
import { useSupabaseClient } from '~/shared/composables/useSupabaseClient'
import { useCurrency } from '~/shared/composables/useCurrency'
import { storeToRefs } from 'pinia'

definePageMeta({ middleware: 'no-services' })

const { menu } = useStorefrontTerms()
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

const formatDate = formatDateTime

function itemsLabel(n: number) {
  return pluralize(n, 'позиция', 'позиции', 'позиций')
}

</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.orders-root {
  max-width: 600px;
  margin: 0 auto;
}

.orders-list {
  @include flex-col(12px);
}

.order-card {
  cursor: pointer;
}

.order-inner {
  @include flex-between(12px);
  padding: 16px;
}

.order-left {
  @include flex-col(4px);
  min-width: 0;
}

.order-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.order-number {
  @include text-xs(600);
  color: var(--color-text-secondary);
  font-family: monospace;
}

.order-total {
  @include text-body-sm(700);
  color: var(--color-text);
}

.order-meta {
  @include text-xs;
  color: var(--color-text-secondary);
}

.order-right {
  @include flex-row(8px);
  flex-shrink: 0;
}

.order-arrow {
  color: var(--color-text-secondary);
}
</style>
