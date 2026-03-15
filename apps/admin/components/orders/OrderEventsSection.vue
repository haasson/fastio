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
              :class="{ 'event-text-block': change.type === 'customized' }"
            >
              <span class="item-badge" :class="change.type">{{ change.badge }}</span>
              <span class="item-name">{{ change.name }}</span>
              <template v-if="change.type === 'modified'">
                <span class="field-old">{{ change.oldQty }} шт.</span>
                <span class="field-arrow">→</span>
                <span class="field-new">{{ change.newQty }} шт.</span>
              </template>
              <template v-else-if="change.type === 'customized'">
                <div class="customized-details">
                  <div v-for="(d, j) in change.details" :key="j" class="detail-line">
                    <template v-if="d.kind === 'modifier'">
                      <span class="detail-label">{{ d.groupName }}:</span>
                      <span class="field-old">{{ d.from }}</span>
                      <span class="field-arrow">→</span>
                      <span class="field-new">{{ d.to }}</span>
                    </template>
                    <template v-else-if="d.kind === 'ingredient'">
                      <span class="detail-sign" :class="d.removed ? 'neg' : 'pos'">{{ d.removed ? '−' : '+' }}</span>
                      <span class="detail-label">ингредиент:</span>
                      <span :class="d.removed ? 'field-old' : 'field-new'">{{ d.name }}</span>
                    </template>
                    <template v-else-if="d.kind === 'addon'">
                      <span class="detail-sign" :class="d.added ? 'pos' : 'neg'">{{ d.added ? '+' : '−' }}</span>
                      <span class="detail-label">добавка:</span>
                      <span :class="d.added ? 'field-new' : 'field-old'">{{ d.name }}</span>
                    </template>
                  </div>
                </div>
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
import { computed, toRefs, watch } from 'vue'
import { UiTimeline, UiTimelineItem } from '@fastio/ui'
import { COLORS } from '@fastio/kit'
import type { OrderEvent, OrderItem } from '@fastio/shared'
import { formatRelativeTime } from '~/utils/formatRelativeTime'
import { FIELD_LABELS } from '~/config/order-events'
import { formatFieldValue, formatEventText } from '~/utils/format-order'
import { useStatusColor } from '~/composables/ui/useStatusColor'
import { useOrderEvents } from '~/composables/data/useOrderEvents'

const props = defineProps<{
  orderId: string
  refreshKey: number
}>()

const { getStatusColor } = useStatusColor()

const { orderId } = toRefs(props)
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

type CustomizedDetail
  = | { kind: 'modifier'; groupName: string; from: string; to: string }
    | { kind: 'ingredient'; name: string; removed: boolean }
    | { kind: 'addon'; name: string; added: boolean }

type ItemChange
  = | { type: 'added' | 'removed'; badge: string; name: string; qty: number }
    | { type: 'modified'; badge: string; name: string; oldQty: number; newQty: number }
    | { type: 'customized'; badge: string; name: string; details: CustomizedDetail[] }

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
    } else {
      const details: CustomizedDetail[] = []

      // Модификаторы
      for (const mod of item.modifiers ?? []) {
        const newMod = (found.modifiers ?? []).find((m) => m.groupName === mod.groupName)

        if (newMod && newMod.optionName !== mod.optionName) {
          details.push({ kind: 'modifier', groupName: mod.groupName, from: mod.optionName, to: newMod.optionName })
        }
      }

      // Убранные ингредиенты
      const oldRemoved = new Set(item.removedIngredients ?? [])
      const newRemoved = new Set(found.removedIngredients ?? [])

      for (const ing of newRemoved) {
        if (!oldRemoved.has(ing)) details.push({ kind: 'ingredient', name: ing, removed: true })
      }
      for (const ing of oldRemoved) {
        if (!newRemoved.has(ing)) details.push({ kind: 'ingredient', name: ing, removed: false })
      }

      // Добавки
      const oldAddonIds = new Set((item.addons ?? []).map((a) => a.addonId))
      const newAddonIds = new Set((found.addons ?? []).map((a) => a.addonId))

      for (const addon of found.addons ?? []) {
        if (!oldAddonIds.has(addon.addonId)) details.push({ kind: 'addon', name: addon.addonName, added: true })
      }
      for (const addon of item.addons ?? []) {
        if (!newAddonIds.has(addon.addonId)) details.push({ kind: 'addon', name: addon.addonName, added: false })
      }

      if (details.length > 0) {
        result.push({ type: 'customized', badge: '±', name: item.dishName, details })
      }
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
  &.modified, &.customized { color: var(--orange-400); }
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

.event-text-block {
  align-items: flex-start;
  flex-wrap: wrap;
}

.customized-details {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 1px;
}

.detail-line {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.detail-label {
  font-weight: 600;
  color: var(--color-text-secondary);
}

.detail-sign {
  font-weight: 700;
  font-size: 11px;
  width: 12px;
  text-align: center;
  flex-shrink: 0;

  &.pos { color: var(--green-500); }
  &.neg { color: var(--red-500); }
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
