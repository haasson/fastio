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
import { computed, watch } from 'vue'
import { UiTimeline, UiTimelineItem } from '@fastio/ui'
import type { OrderEvent, OrderItem } from '@fastio/shared'
import { formatRelativeTime } from '~/utils/formatRelativeTime'
import { FIELD_LABELS } from '~/config/order-events'
import { COLORS } from '@fastio/ui'
import { formatFieldValue, formatEventText } from '~/utils/format-order'
import { useStatusColor } from '~/composables/useStatusColor'
import { useOrderEvents } from '~/composables/data/useOrderEvents'

const props = defineProps<{
  orderId: string
  refreshKey: number
}>()

const { getStatusColor } = useStatusColor()

const orderId = computed(() => props.orderId)
const { events, loading, refresh } = useOrderEvents(orderId)
const now = new Date()

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

watch(() => props.refreshKey, refresh)
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
