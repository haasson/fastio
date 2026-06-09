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
        <UiText v-if="session" size="small" type="secondary">{{ formatDateTime(session.createdAt) }}</UiText>
      </div>
    </template>

    <div v-if="session" class="session-body">
      <!-- Шапка чека -->
      <UiCard size="small">
        <div class="summary">
          <UiKeyValue label="Гость" :value="session.customerName ?? '—'" />
          <UiKeyValue label="Телефон" :value="session.customerPhone ?? '—'" />
          <UiKeyValue label="Статус">
            <UiTag size="small" round :type="statusTagType">{{ statusName }}</UiTag>
          </UiKeyValue>
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
import { UiDrawer, UiCard, UiTitle, UiText, UiTag, UiKeyValue, UiSectionHeader } from '@fastio/ui'
import type { Reservation } from '@fastio/shared'
import { formatDateTime, formatPrice } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import { storeToRefs } from 'pinia'
import type { TableSession as OrderTableSession } from '~/features/orders'
import { useOrderStatusesStore } from '~/features/orders'
import { useTeam } from '~/features/team'
import { useDatabase } from '~/shared/data/useDatabase'
import { STATUS_GROUP_TAG_TYPES } from '~/config/retail/order-status-groups'
import OrderEventsSection from '~/features/orders/components/OrderEventsSection.vue'

const props = defineProps<{
  modelValue: boolean
  session: OrderTableSession | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const api = useDatabase()
const orderStatusesStore = useOrderStatusesStore()
const { statuses } = storeToRefs(orderStatusesStore)
const { members, load: loadTeam } = useTeam()

const reservation = ref<Reservation | null>(null)
const refreshKey = ref(0)

// uuid → отображаемое имя сотрудника (для блока брони).
const memberNames = computed(() => {
  const map = new Map<string, string>()

  for (const m of members.value) {
    map.set(m.userId, m.displayName ?? m.email ?? m.userId)
  }

  return map
})

const statusMeta = computed(() => statuses.value.find((s) => s.id === props.session?.status) ?? null)
const statusName = computed(() => statusMeta.value?.name ?? '—')
const statusTagType = computed(() => statusMeta.value ? STATUS_GROUP_TAG_TYPES[statusMeta.value.groupType] : 'default')

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

watch(
  () => [props.modelValue, props.session?.id] as const,
  ([open, id]) => {
    if (!open || !id) return
    refreshKey.value++
    void loadReservation(id)
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
