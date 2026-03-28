<template>
  <div class="page-root">
    <header class="header">
      <NButton quaternary @click="$router.push('/tenants')">← Назад</NButton>
      <h2 v-if="tenant" class="title">{{ tenant.name }}</h2>
    </header>

    <div v-if="loading" class="loading">Загрузка…</div>

    <template v-else-if="tenant">
      <!-- Info -->
      <section class="card">
        <div class="card-header">
          <h3 class="card-title">Информация</h3>
          <NButton type="error" size="small" :loading="deleteLoading" @click="handleDelete">Удалить тенанта</NButton>
        </div>
        <div class="info-grid">
          <div><span class="label">Слаг:</span> {{ tenant.slug }}</div>
          <div><span class="label">Email владельца:</span> {{ tenant.ownerEmail }}</div>
          <div><span class="label">Статус подписки:</span> <NTag :type="statusType" size="small">{{ tenant.subscription?.status }}</NTag></div>
          <div><span class="label">Текущий тариф:</span> {{ currentPlanName }}</div>
          <div><span class="label">Баланс:</span> <strong :class="{ 'balance-low': tenant.balance <= 0 }">{{ tenant.balance }} ₽</strong></div>
          <div v-if="tenant.subscription?.renewsAt"><span class="label">Следующее списание:</span> {{ formatDate(tenant.subscription.renewsAt) }}</div>
          <div>
            <span class="label">Цена подписки:</span>
            <template v-if="tenant.subscription?.priceOverride != null">
              <strong>{{ tenant.subscription.priceOverride }} ₽</strong>
              <NTag size="tiny" class="override-tag">кастомная</NTag>
            </template>
            <template v-else>
              {{ currentPlanPrice }} ₽ <span class="hint">(по тарифу)</span>
            </template>
          </div>
        </div>
      </section>

      <!-- Topup -->
      <section class="card">
        <h3 class="card-title">Пополнить баланс</h3>
        <div class="row-form">
          <NInputNumber
            v-model:value="topupAmount"
            :min="1"
            placeholder="Сумма"
            style="width: 160px"
          />
          <NInput v-model:value="topupDescription" placeholder="Описание (опционально)" style="width: 280px" />
          <NButton
            type="primary"
            :loading="topupLoading"
            :disabled="!topupAmount || topupAmount <= 0"
            @click="handleTopup"
          >
            Пополнить
          </NButton>
        </div>
      </section>

      <!-- Price override -->
      <section class="card">
        <h3 class="card-title">Кастомная цена</h3>
        <p class="hint-text">Установите индивидуальную цену для этого клиента. Оставьте пустым, чтобы использовать цену тарифа.</p>
        <div class="row-form">
          <NInputNumber
            v-model:value="priceOverrideInput"
            :min="0"
            placeholder="Цена (₽/мес)"
            clearable
            style="width: 200px"
          />
          <NButton
            type="primary"
            :loading="priceOverrideLoading"
            @click="handleSetPriceOverride"
          >
            {{ priceOverrideInput != null ? 'Установить' : 'Сбросить на тариф' }}
          </NButton>
          <NButton
            v-if="tenant.subscription?.priceOverride != null"
            :loading="priceOverrideLoading"
            @click="handleResetPriceOverride"
          >
            Сбросить
          </NButton>
        </div>
      </section>

      <!-- Change plan -->
      <section class="card">
        <h3 class="card-title">Сменить тариф</h3>
        <div class="plan-buttons">
          <NButton
            v-for="plan in tenant.plans"
            :key="plan.id"
            :type="plan.key === tenant.subscription?.plan ? 'primary' : 'default'"
            :disabled="plan.key === tenant.subscription?.plan || changePlanLoading !== null"
            :loading="changePlanLoading === plan.key"
            @click="handleChangePlan(plan.key)"
          >
            {{ plan.name }} ({{ plan.price > 0 ? `${plan.price} ₽` : 'Бесплатно' }})
          </NButton>
        </div>
      </section>

      <!-- Transactions -->
      <section class="card">
        <h3 class="card-title">История операций</h3>
        <NDataTable
          :columns="txColumns"
          :data="tenant.transactions"
          :bordered="false"
          :pagination="{ pageSize: 20 }"
          striped
          size="small"
        />
      </section>
    </template>

    <!-- Delete confirmation modal -->
    <NModal v-model:show="deleteModalOpen" preset="card" title="Удалить тенанта" style="max-width: 440px">
      <p class="delete-hint">Это действие необратимо. Введите слаг тенанта <strong>{{ tenant?.slug }}</strong>, чтобы подтвердить.</p>
      <NInput v-model:value="deleteSlugInput" placeholder="slug" @keydown.enter="deleteSlugInput === tenant?.slug && confirmDelete()" />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="deleteModalOpen = false">Отмена</NButton>
          <NButton
            type="error"
            :disabled="deleteSlugInput !== tenant?.slug"
            :loading="deleteLoading"
            @click="confirmDelete"
          >
            Удалить
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useFetch, navigateTo } from '#imports'
import { $fetch } from 'ofetch'
import { ref, computed, h, watch } from 'vue'
import { NButton, NTag, NInput, NInputNumber, NDataTable, NModal, NSpace, type DataTableColumns } from 'naive-ui'

const route = useRoute()
const tenantId = route.params.id as string

type TxRow = {
  id: string
  type: string
  amount: number
  description: string
  created_at: string
}

type PlanRow = {
  id: string
  key: string
  name: string
  price: number
  sort_order: number
}

type TenantDetail = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  subscription: { status: string; plan: string; renewsAt?: string; pastDueAt?: string; priceOverride?: number | null }
  balance: number
  createdAt: string
  transactions: TxRow[]
  plans: PlanRow[]
}

const { data: tenant, pending: loading, refresh } = await useFetch<TenantDetail>(`/api/tenants/${tenantId}`)

const statusType = computed(() => {
  const s = tenant.value?.subscription?.status

  if (s === 'active') return 'success'
  if (s === 'past_due') return 'warning'
  if (s === 'suspended') return 'error'
  if (s === 'trial') return 'info'

  return 'default'
})

const currentPlanName = computed(() => {
  const planKey = tenant.value?.subscription?.plan
  const plan = tenant.value?.plans?.find((p) => p.key === planKey)

  return plan?.name ?? planKey ?? '—'
})

const currentPlanPrice = computed(() => {
  const planKey = tenant.value?.subscription?.plan
  const plan = tenant.value?.plans?.find((p) => p.key === planKey)

  return plan?.price ?? 0
})

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

// ─── Topup ──────────────────────────────────────────────────────────────────────

const topupAmount = ref<number | null>(null)
const topupDescription = ref('')
const topupLoading = ref(false)

const handleTopup = async () => {
  if (!topupAmount.value || topupAmount.value <= 0) return

  topupLoading.value = true
  try {
    await $fetch(`/api/tenants/${tenantId}/topup`, {
      method: 'POST',
      body: { amount: topupAmount.value, description: topupDescription.value },
    })
    topupAmount.value = null
    topupDescription.value = ''
    await refresh()
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка'

    window.alert(message)
  } finally {
    topupLoading.value = false
  }
}

// ─── Price override ─────────────────────────────────────────────────────────────

const priceOverrideInput = ref<number | null>(null)
const priceOverrideLoading = ref(false)

watch(tenant, (t) => {
  priceOverrideInput.value = t?.subscription?.priceOverride ?? null
}, { immediate: true })

const handleSetPriceOverride = async () => {
  priceOverrideLoading.value = true
  try {
    await $fetch(`/api/tenants/${tenantId}/set-price`, {
      method: 'POST',
      body: { price: priceOverrideInput.value },
    })
    await refresh()
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка'

    window.alert(message)
  } finally {
    priceOverrideLoading.value = false
  }
}

const handleResetPriceOverride = async () => {
  priceOverrideLoading.value = true
  try {
    await $fetch(`/api/tenants/${tenantId}/set-price`, {
      method: 'POST',
      body: { price: null },
    })
    priceOverrideInput.value = null
    await refresh()
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка'

    window.alert(message)
  } finally {
    priceOverrideLoading.value = false
  }
}

// ─── Change plan ────────────────────────────────────────────────────────────────

const changePlanLoading = ref<string | null>(null)

const handleChangePlan = async (planKey: string) => {
  changePlanLoading.value = planKey
  try {
    await $fetch(`/api/tenants/${tenantId}/change-plan`, {
      method: 'POST',
      body: { plan_key: planKey },
    })
    await refresh()
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка'

    window.alert(message)
  } finally {
    changePlanLoading.value = null
  }
}

// ─── Delete tenant ──────────────────────────────────────────────────────────────

const deleteModalOpen = ref(false)
const deleteSlugInput = ref('')
const deleteLoading = ref(false)

const handleDelete = () => {
  deleteSlugInput.value = ''
  deleteModalOpen.value = true
}

const confirmDelete = async () => {
  deleteLoading.value = true
  try {
    await $fetch(`/api/tenants/${tenantId}`, { method: 'DELETE' })
    await navigateTo('/tenants')
  } catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка'

    window.alert(message)
  } finally {
    deleteLoading.value = false
  }
}

// ─── Transactions table ─────────────────────────────────────────────────────────

const txTypeLabel: Record<string, string> = { topup: 'Пополнение', charge: 'Списание', refund: 'Возврат' }
const txTypeColor: Record<string, 'success' | 'error' | 'info'> = { topup: 'success', charge: 'error', refund: 'info' }

const txColumns: DataTableColumns<TxRow> = [
  {
    title: 'Дата',
    key: 'created_at',
    width: 140,
    render: (row) => formatDate(row.created_at),
  },
  {
    title: 'Тип',
    key: 'type',
    width: 120,
    render: (row) => h(NTag, { type: txTypeColor[row.type] ?? 'default', size: 'small' }, { default: () => txTypeLabel[row.type] ?? row.type }),
  },
  {
    title: 'Сумма',
    key: 'amount',
    width: 120,
    render: (row) => `${row.amount > 0 ? '+' : ''}${row.amount} ₽`,
  },
  {
    title: 'Описание',
    key: 'description',
  },
]
</script>

<style scoped>
.page-root {
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title {
  font-size: 22px;
  font-weight: 700;
}

.loading {
  color: #888;
  padding: 40px;
  text-align: center;
}

.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  font-size: 14px;
}

.label {
  color: #888;
}

.hint {
  color: #aaa;
  font-size: 13px;
}

.hint-text {
  color: #888;
  font-size: 13px;
  margin-bottom: 12px;
}

.override-tag {
  margin-left: 6px;
}

.delete-hint {
  font-size: 14px;
  margin-bottom: 12px;
  color: #555;
}

.balance-low {
  color: #e03;
}

.row-form {
  display: flex;
  align-items: center;
  gap: 12px;
}

.plan-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
