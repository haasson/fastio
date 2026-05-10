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
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from '#imports'
import { UiButton, UiSkeleton, UiEmpty } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import OrderContent from '~/features/orders/components/OrderContent.vue'

const route = useRoute()
const router = useRouter()
const api = useDatabase()
const { tenantId } = storeToRefs(useTenantStore())

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
@use '@fastio/styles/mixins/layout' as *;

.order-page-root {
  @include flex-col(var(--space-20));
}

.page-header {
  @include flex-row(var(--space-12));
}

.page-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.actions {
  display: flex;
  justify-content: flex-end;
}
</style>
