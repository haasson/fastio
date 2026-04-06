<template>
  <div class="order-page-root">
    <div class="page-header">
      <UiButton
        type="default"
        size="small"
        icon="chevronLeft"
        @click="router.push('/orders')"
      >
        Назад
      </UiButton>
      <span class="page-title">{{ order ? `Заказ #${order.orderNumber}` : 'Заказ' }}</span>
    </div>

    <UiSkeleton v-if="loading" :height="400" />

    <UiEmpty v-else-if="!order" icon="orders" text="Заказ не найден" />

    <template v-else>
      <OrderContent
        ref="contentRef"
        :order="order"
        :tenant-id="tenantId"
        @saved="onSaved"
      />

      <div class="actions">
        <UiButton
          type="primary"
          :loading="contentRef?.saving"
          @click="contentRef?.save()"
        >Сохранить</UiButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiButton, UiSkeleton, UiEmpty } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import OrderContent from '~/components/orders/OrderContent.vue'

const route = useRoute()
const router = useRouter()
const api = useDatabase()
const tenantStore = useTenantStore()

tenantStore.init()

const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const order = ref<Order | null>(null)
const loading = ref(true)
const contentRef = ref<InstanceType<typeof OrderContent> | null>(null)

onMounted(async () => {
  try {
    order.value = await api.orders.getById(route.params.id as string)
  } finally {
    loading.value = false
  }
})

const onSaved = (updated: Order) => {
  order.value = updated
}
</script>

<style scoped lang="scss">
.order-page-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
