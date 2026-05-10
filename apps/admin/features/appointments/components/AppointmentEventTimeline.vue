<template>
  <div class="event-timeline-root">
    <UiSkeleton v-if="loading" :repeat="3" />
    <UiEmpty v-else-if="events.length === 0" text="Событий нет" />
    <UiTimeline v-else>
      <UiTimelineItem v-for="event in events" :key="event.id">
        <template #default>
          <template v-if="event.eventType === 'field_updated'">
            <div v-for="(change, i) in fieldChanges(event)" :key="i" class="event-text">
              <UiText size="small" span class="field-label">{{ change.label }}:</UiText>
              <UiText size="small" span class="field-old">{{ change.oldFormatted }}</UiText>
              <UiText size="small" span class="field-arrow">→</UiText>
              <UiText size="small" span class="field-new">{{ change.newFormatted }}</UiText>
            </div>
          </template>
          <UiText v-else size="small" class="event-text">{{ formatAppointmentEventText(event) }}</UiText>
        </template>
        <template #footer>
          <div class="event-meta">
            <UiText size="tiny" span class="event-actor">{{ event.actorName ?? getAppointmentEventActorFallback(event) }}</UiText>
            <UiText size="tiny" span>·</UiText>
            <UiText size="tiny" span class="event-time">{{ formatRelativeTime(event.createdAt, now) }}</UiText>
          </div>
        </template>
      </UiTimelineItem>
    </UiTimeline>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiText, UiTimeline, UiTimelineItem, UiEmpty, UiSkeleton } from '@fastio/ui'
import type { AppointmentEvent } from '@fastio/shared'
import {
  formatRelativeTime,
  formatAppointmentEventText,
  getAppointmentEventActorFallback,
  extractAppointmentFieldChanges,
} from '@fastio/shared'

const props = withDefaults(defineProps<{
  events: AppointmentEvent[]
  timezone: string
  loading?: boolean
}>(), { loading: false })

const now = useNow({ interval: 60_000 })

const formatDate = computed(() => (iso: string) => new Intl.DateTimeFormat('ru', {
  timeZone: props.timezone,
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso)))

const fieldChanges = (event: AppointmentEvent) => extractAppointmentFieldChanges(event, formatDate.value)
</script>

<style scoped lang="scss">
.event-timeline-root {
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

.event-time {
  color: var(--color-text-secondary);
}
</style>
