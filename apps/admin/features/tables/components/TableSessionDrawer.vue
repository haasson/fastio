<template>
  <UiDrawer
    :model-value="modelValue"
    :width="640"
    header-align="start"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <template #title>
      <div class="session-title">
        <UiTitle size="h4">{{ session?.tableName ?? 'Стол' }}</UiTitle>
        <UiText v-if="session" size="small" type="secondary">{{ formatDateTime(session.settledAt ?? session.createdAt) }}</UiText>
      </div>
    </template>

    <div v-if="session" class="session-body">
      <!-- Шапка чека -->
      <UiCard size="small">
        <div class="summary">
          <UiKeyValue label="Гость" :value="session.customerName ?? '—'" />
          <UiKeyValue label="Телефон" :value="session.customerPhone ?? '—'" />
          <UiKeyValue label="Оплата" :value="paymentLabel" />
          <UiKeyValue label="Рассчитал" :value="settledLabel" />
          <UiKeyValue label="Итог">
            <span class="total">
              <span>{{ formatPrice(session.total) }}</span>
              <UiText v-if="session.discountAmount > 0" size="small" class="discount">
                − {{ formatPrice(session.discountAmount) }} скидка
              </UiText>
            </span>
          </UiKeyValue>
        </div>
      </UiCard>

      <!-- Позиции -->
      <div class="block">
        <UiSectionHeader title="Позиции" />
        <UiCard v-if="items.length" size="small">
          <div class="items">
            <div v-for="item in items" :key="item.id" class="item-row">
              <UiText size="small" class="item-name">{{ item.dishName }}</UiText>
              <UiText size="tiny" class="item-qty">× {{ item.quantity }}</UiText>
              <UiText size="small" class="item-sum">{{ formatPrice(item.price * item.quantity) }}</UiText>
            </div>
          </div>
        </UiCard>
        <UiEmpty v-else icon="dishes" text="Позиций нет" />
      </div>

      <!-- Бронь -->
      <div v-if="reservation" class="block">
        <UiSectionHeader title="Бронь" />
        <UiCard size="small">
          <div class="summary">
            <UiKeyValue label="Бронировал" :value="reservation.guestName || '—'" />
            <UiKeyValue
              v-if="reservation.confirmedAt"
              label="Подтвердил"
              :value="confirmedLabel"
            />
            <UiKeyValue
              v-if="reservation.seatedAt"
              label="Посажен"
              :value="formatDateTime(reservation.seatedAt)"
            />
          </div>
        </UiCard>
      </div>

      <!-- Таймлайн -->
      <div class="block">
        <UiSectionHeader title="Таймлайн" />
        <OrderEventsSection :order-id="session.id" :refresh-key="refreshKey" />
      </div>
    </div>
  </UiDrawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiDrawer, UiCard, UiTitle, UiText, UiKeyValue, UiSectionHeader, UiEmpty } from '@fastio/ui'
import type { Reservation, OrderItem } from '@fastio/shared'
import { formatDateTime, formatPrice } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import type { TableSession as OrderTableSession } from '~/features/orders'
import { useTeam } from '~/features/team'
import { useDatabase } from '~/shared/data/useDatabase'
import OrderEventsSection from '~/features/orders/components/OrderEventsSection.vue'

const PAYMENT_LABEL: Record<string, string> = { cash: 'Наличные', card: 'Карта', online: 'Онлайн' }

const props = defineProps<{
  modelValue: boolean
  session: OrderTableSession | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const api = useDatabase()
const { members, load: loadTeam } = useTeam()

const reservation = ref<Reservation | null>(null)
const items = ref<OrderItem[]>([])
const refreshKey = ref(0)

// uuid → отображаемое имя сотрудника (для блока брони).
const memberNames = computed(() => {
  const map = new Map<string, string>()

  for (const m of members.value) {
    map.set(m.userId, m.displayName ?? m.email ?? m.userId)
  }

  return map
})

const paymentLabel = computed(() => props.session?.paymentType ? PAYMENT_LABEL[props.session.paymentType] : '—')

const settledLabel = computed(() => {
  const s = props.session

  if (!s?.settledAt) return '—'

  const name = s.settledBy ? memberNames.value.get(s.settledBy) ?? s.settledBy : null

  return name ? `${name} · ${formatDateTime(s.settledAt)}` : formatDateTime(s.settledAt)
})

const confirmedLabel = computed(() => {
  const r = reservation.value

  if (!r?.confirmedAt) return '—'

  const name = r.confirmedBy ? memberNames.value.get(r.confirmedBy) ?? r.confirmedBy : null

  return name ? `${name} · ${formatDateTime(r.confirmedAt)}` : formatDateTime(r.confirmedAt)
})

const loadReservation = async (orderId: string) => {
  try {
    reservation.value = await api.reservations.getByOrderId(orderId)
  } catch (e) {
    reportError(e, { context: 'tables:tableSessionDrawer:loadReservation', orderId })
    reservation.value = null
  }
}

const loadCheck = async (orderId: string) => {
  try {
    const order = await api.orders.getById(orderId)

    items.value = order?.items ?? []
  } catch (e) {
    reportError(e, { context: 'tables:tableSessionDrawer:loadCheck', orderId })
    items.value = []
  }
}

watch(
  () => [props.modelValue, props.session?.id] as const,
  ([open, id]) => {
    if (!open || !id) return
    refreshKey.value++
    void loadReservation(id)
    void loadCheck(id)
    if (!members.value.length) void loadTeam()
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.session-title {
  @include flex-col(var(--space-4));
}

.session-body {
  @include flex-col(var(--space-20));
}

.block {
  @include flex-col(var(--space-8));
}

.summary {
  @include flex-col(var(--space-8));
}

.items {
  @include flex-col(var(--space-8));
}

.item-row {
  display: flex;
  align-items: baseline;
  gap: var(--space-8);
}

.item-name {
  flex: 1 1 auto;
  min-width: 0;
}

.item-qty {
  color: var(--color-text-hint);
  white-space: nowrap;
}

.item-sum {
  flex: 0 0 auto;
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.total {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  font-weight: var(--font-weight-semibold);
}

.discount {
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-regular);
}
</style>
