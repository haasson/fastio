<template>
  <div>
    <UiSectionHeader title="История операций" class="tx-title" />

    <div v-if="loading" class="state-msg">Загрузка…</div>
    <div v-else-if="transactions.length === 0" class="state-msg">Операций пока нет</div>
    <div v-else class="tx-table">
      <div class="tx-row tx-header">
        <span>Дата</span>
        <span>Тип</span>
        <span>Сумма</span>
        <span>Описание</span>
      </div>
      <div v-for="tx in transactions" :key="tx.id" class="tx-row">
        <span>{{ formatDate(tx.createdAt) }}</span>
        <UiTag :type="txTagType(tx.type)" size="small">{{ txLabel(tx.type) }}</UiTag>
        <span :class="{ 'tx-positive': tx.amount > 0, 'tx-negative': tx.amount < 0 }">
          {{ tx.amount > 0 ? '+' : '' }}{{ formatPrice(tx.amount) }}
        </span>
        <span class="tx-desc">{{ tx.description }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { BillingTransaction, BillingTransactionType } from '@fastio/shared'
import { formatPrice } from '@fastio/shared'
import { UiTag, UiSectionHeader } from '@fastio/ui'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'

const api = useDatabase()
const tenantStore = useTenantStore()

const transactions = ref<BillingTransaction[]>([])
const loading = ref(true)

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

const txLabel = (type: BillingTransactionType) => {
  const labels: Record<BillingTransactionType, string> = { topup: 'Пополнение', charge: 'Списание', refund: 'Возврат' }

  return labels[type]
}

const txTagType = (type: BillingTransactionType) => {
  const types: Record<BillingTransactionType, 'success' | 'error' | 'warning'> = { topup: 'success', charge: 'error', refund: 'warning' }

  return types[type]
}

const load = async () => {
  if (!tenantStore.tenant) return
  loading.value = true
  try {
    transactions.value = await api.billing.getTransactions(tenantStore.tenant.id)
  } finally {
    loading.value = false
  }
}

defineExpose({ reload: load })

onMounted(() => load())
</script>

<style scoped lang="scss">
.tx-title {
  margin-bottom: var(--space-16);
}

.tx-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  overflow: hidden;
  min-width: 500px;
}

.tx-row {
  display: grid;
  grid-template-columns: 120px 110px 120px 1fr;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-16);
  align-items: center;
  font-size: var(--font-size-md);
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }

  &.tx-header {
    font-weight: var(--font-weight-semibold);
    background: var(--color-bg-page);
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
  }
}

.tx-positive {
  color: var(--color-success);
  font-weight: var(--font-weight-semibold);
}

.tx-negative {
  color: var(--color-error);
}

.tx-desc {
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.state-msg {
  color: var(--color-text-hint);
  padding: var(--space-24) 0;
  text-align: center;
}
</style>
