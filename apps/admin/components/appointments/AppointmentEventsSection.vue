<template>
  <section class="section">
    <UiSkeleton v-if="loading" :repeat="3" />
    <UiEmpty v-else-if="events.length === 0" text="История пуста" />
    <UiTimeline v-else>
      <UiTimelineItem
        v-for="event in events"
        :key="event.id"
      >
        <template #default>
          <template v-if="event.eventType === 'field_updated'">
            <div
              v-for="(change, i) in fieldChanges(event)"
              :key="i"
              class="event-text"
            >
              <UiText size="small" span class="field-label">{{ change.label }}:</UiText>
              <UiText size="small" span class="field-old">{{ change.oldFormatted }}</UiText>
              <UiText size="small" span class="field-arrow">→</UiText>
              <UiText size="small" span class="field-new">{{ change.newFormatted }}</UiText>
            </div>
          </template>
          <UiText v-else size="small" class="event-text">{{ eventText(event) }}</UiText>
        </template>
        <template #footer>
          <div class="event-meta">
            <UiText size="tiny" span class="event-actor">{{ event.actorName ?? actorFallback(event) }}</UiText>
            <UiText size="tiny" span class="event-sep">·</UiText>
            <UiText size="tiny" span class="event-time">{{ formatRelativeTime(event.createdAt, now) }}</UiText>
          </div>
        </template>
      </UiTimelineItem>
    </UiTimeline>
  </section>
</template>

<script setup lang="ts">
import { toRefs, computed, watch } from 'vue'
import { useNow } from '@vueuse/core'
import { UiTimeline, UiTimelineItem, UiSkeleton, UiEmpty, UiText } from '@fastio/ui'
import type { AppointmentEvent, AppointmentStatus } from '@fastio/shared'
import { formatRelativeTime } from '@fastio/shared'
import { useAppointmentEvents } from '~/composables/data/useAppointmentEvents'
import { useTenantStore } from '~/stores/tenant'

const tenantStore = useTenantStore()
const tz = computed(() => tenantStore.tenant.timezone)

const props = defineProps<{
  appointmentId: string
  refreshKey?: number
}>()

const { appointmentId } = toRefs(props)
const { events, loading, refresh } = useAppointmentEvents(appointmentId)
// Тикаем раз в минуту — этого достаточно чтобы метки "3 минуты назад"
// обновлялись на UI без излишней нагрузки.
const now = useNow({ interval: 60_000 })

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  done: 'Завершена',
  cancelled: 'Отменена',
}

const FIELD_LABELS: Record<string, string> = {
  service_id: 'Услуга',
  resource_id: 'Исполнитель',
  customer_name: 'Имя клиента',
  customer_phone: 'Телефон',
  notes: 'Примечание',
  starts_at: 'Начало',
  ends_at: 'Окончание',
}

const formatFieldValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'starts_at' || field === 'ends_at') {
    return new Intl.DateTimeFormat('ru', {
      timeZone: tz.value,
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(new Date(String(value)))
  }

  return String(value)
}

type FieldChange = { label: string; oldFormatted: string; newFormatted: string }

const fieldChanges = (event: AppointmentEvent): FieldChange[] => {
  const changes = Array.isArray(event.meta.changes)
    ? event.meta.changes as Array<{ field: string; old_value: unknown; new_value: unknown }>
    : []

  return changes.map((c) => ({
    label: FIELD_LABELS[c.field] ?? c.field,
    oldFormatted: formatFieldValue(c.field, c.old_value),
    newFormatted: formatFieldValue(c.field, c.new_value),
  }))
}

const eventText = (event: AppointmentEvent): string => {
  if (event.eventType === 'appointment_created') {
    const source = event.meta.source as string | undefined

    if (source === 'storefront') return 'Создана клиентом через сайт'

    return 'Запись создана'
  }
  if (event.eventType === 'status_changed') {
    const from = STATUS_LABELS[event.meta.from as AppointmentStatus] ?? '?'
    const to = STATUS_LABELS[event.meta.to as AppointmentStatus] ?? '?'

    return `Статус: ${from} → ${to}`
  }
  if (event.eventType === 'extended') {
    return `Продлена на ${event.meta.minutes ?? '?'} мин`
  }
  if (event.eventType === 'closed_now') {
    return 'Закрыта сейчас'
  }

  return event.eventType
}

const actorFallback = (event: AppointmentEvent): string => {
  if (event.eventType === 'appointment_created' && event.meta.source === 'storefront') return 'Клиент'

  return 'Система'
}

watch(() => props.refreshKey, () => refresh())
</script>

<style scoped lang="scss">
.section {
  min-height: 32px;
}

.event-text {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.field-label {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.field-old {
  color: var(--color-text-secondary);
  text-decoration: line-through;
}

.field-arrow {
  color: var(--color-text-secondary);
}

.field-new {
  color: var(--color-text);
  font-weight: var(--font-weight-medium);
}

.event-meta {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-4);
}

.event-actor {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.event-sep {
  color: var(--color-text-secondary);
}

.event-time {
  color: var(--color-text-secondary);
}
</style>
