<template>
  <section class="section">
    <div v-if="loading" class="empty">Загрузка…</div>
    <div v-else-if="events.length === 0" class="empty">История событий пуста</div>
    <UiTimeline v-else>
      <UiTimelineItem
        v-for="{ event, color } in enrichedEvents"
        :key="event.id"
        :color="color"
      >
        <template #default>
          <template v-if="event.eventType === 'field_updated'">
            <div
              v-for="(change, i) in fieldChanges(event)"
              :key="i"
              class="event-text"
            >
              <span class="field-label">{{ change.label }}:</span>
              <span class="field-old">{{ change.oldFormatted }}</span>
              <span class="field-arrow">→</span>
              <span class="field-new">{{ change.newFormatted }}</span>
            </div>
          </template>
          <template v-else-if="event.eventType === 'items_updated'">
            <div
              v-for="(change, i) in itemsChanges(event)"
              :key="i"
              class="event-text"
            >
              <span class="item-badge" :class="change.type">{{ change.badge }}</span>
              <span class="item-name">{{ change.name }}</span>
              <template v-if="change.type === 'modified'">
                <span class="field-old">{{ change.oldQty }} шт.</span>
                <span class="field-arrow">→</span>
                <span class="field-new">{{ change.newQty }} шт.</span>
              </template>
              <template v-else>
                <span class="item-qty">× {{ change.qty }}</span>
              </template>
            </div>
          </template>
          <div v-else class="event-text">{{ eventText(event) }}</div>
        </template>
        <template #footer>
          <div class="event-meta">
            <span class="event-actor">{{ event.actorName ?? 'Сторфронт' }}</span>
            <span class="event-sep">·</span>
            <span class="event-time">{{ formatRelativeTime(event.createdAt, now) }}</span>
          </div>
        </template>
      </UiTimelineItem>
    </UiTimeline>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useNuxtApp } from '#imports'
import { UiTimeline, UiTimelineItem } from '@fastio/ui'
import type { OrderEvent, OrderItem } from '@fastio/shared'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useSupabaseApi } from '~/composables/useSupabaseApi'
import { mapOrderEvent } from '~/utils/api/order-events'
import { formatRelativeTime } from '~/utils/formatRelativeTime'
import { FIELD_LABELS } from '~/config/order-events'
import { COLORS } from '@fastio/ui'
import { formatFieldValue, formatEventText } from '~/utils/format-order'
import { useStatusColor } from '~/composables/useStatusColor'

const props = defineProps<{
  orderId: string
  refreshKey: number
}>()

const { $supabase } = useNuxtApp()
const api = useSupabaseApi()
const { getStatusColor } = useStatusColor()

const loading = ref(false)
const events = ref<OrderEvent[]>([])
const now = new Date()

let channel: RealtimeChannel | null = null

const enrichedEvents = computed(() => {
  const firstChange = events.value.find((e) => e.eventType === 'status_changed')
  let runningColor = firstChange ? getStatusColor(firstChange.meta.from_id) : COLORS.GREY_400

  return events.value.map((event) => {
    if (event.eventType === 'status_changed') {
      runningColor = getStatusColor(event.meta.to_id)
    }

    return { event, color: runningColor }
  })
})

type FieldChange = { label: string; oldFormatted: string; newFormatted: string }

const fieldChanges = (event: OrderEvent): FieldChange[] => {
  const changes = Array.isArray(event.meta.changes)
    ? event.meta.changes as Array<{ field: string; old_value: unknown; new_value: unknown }>
    : []

  return changes.map((c) => ({
    label: FIELD_LABELS[c.field] ?? c.field,
    oldFormatted: formatFieldValue(c.field, c.old_value),
    newFormatted: formatFieldValue(c.field, c.new_value),
  }))
}

type ItemChange
  = | { type: 'added' | 'removed'; badge: string; name: string; qty: number }
    | { type: 'modified'; badge: string; name: string; oldQty: number; newQty: number }

const itemsChanges = (event: OrderEvent): ItemChange[] => {
  const before = (event.meta.before ?? []) as OrderItem[]
  const after = (event.meta.after ?? []) as OrderItem[]

  const result: ItemChange[] = []

  for (const item of before) {
    const found = after.find((a) => a.dishId === item.dishId)

    if (!found) {
      result.push({ type: 'removed', badge: '−', name: item.dishName, qty: item.quantity })
    } else if (found.quantity !== item.quantity) {
      result.push({ type: 'modified', badge: '±', name: item.dishName, oldQty: item.quantity, newQty: found.quantity })
    }
  }

  for (const item of after) {
    if (!before.find((b) => b.dishId === item.dishId)) {
      result.push({ type: 'added', badge: '+', name: item.dishName, qty: item.quantity })
    }
  }

  return result.length > 0 ? result : [{ type: 'modified', badge: '±', name: 'Состав изменён', oldQty: 0, newQty: 0 }]
}

const eventText = (event: OrderEvent) => formatEventText(event.eventType, event.meta)

const fetchEvents = async () => {
  loading.value = true
  events.value = await api.orderEvents.list(props.orderId)
  loading.value = false
}

const setupRealtime = async () => {
  channel?.unsubscribe()
  const { data: { session } } = await $supabase.auth.getSession()

  if (session?.access_token) $supabase.realtime.setAuth(session.access_token)

  channel = $supabase
    .channel(`order_events:${props.orderId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'order_events',
      filter: `order_id=eq.${props.orderId}`,
    }, ({ new: row }) => {
      const event = mapOrderEvent(row as Record<string, unknown>)

      if (!events.value.find((e) => e.id === event.id)) {
        events.value.push(event)
      }
    })
    .subscribe()
}

watch(
  () => props.refreshKey,
  () => {
    events.value = []
    fetchEvents()
    setupRealtime()
  },
  { immediate: true },
)

onUnmounted(() => channel?.unsubscribe())
</script>

<style scoped lang="scss">
.section {
  min-height: 32px;
}

.empty {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.event-text {
  font-size: 13px;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.item-badge {
  font-size: 11px;
  font-weight: 700;
  width: 16px;
  text-align: center;
  flex-shrink: 0;

  &.added { color: var(--green-500); }
  &.removed { color: var(--red-500); }
  &.modified { color: var(--orange-400); }
}

.item-name {
  color: var(--color-text);
}

.item-qty {
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.field-label {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.field-old {
  color: var(--color-text-tertiary);
  text-decoration: line-through;
}

.field-arrow {
  color: var(--color-text-tertiary);
  font-size: 11px;
}

.field-new {
  color: var(--color-text);
  font-weight: 500;
}

.event-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 1px;
}

.event-actor {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.event-sep {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

.event-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
</style>
