<template>
  <div class="slot-picker-root">
    <UiCard>
      <UiTitle size="h4" class="card-title">Время визита</UiTitle>

      <template v-if="!isReadOnly">
        <UiDatepicker v-model="dateTs" label="Дата визита" :disabled="saving" />

        <div class="slots-section">
          <UiText v-if="!hasDate" size="small" class="muted">
            Выберите дату — появятся доступные слоты
          </UiText>
          <UiText v-else-if="activeServicesCount === 0" size="small" class="muted">
            Добавьте хотя бы одну услугу
          </UiText>

          <div v-else-if="loadingSlots" class="slots-loading">
            <UiSkeleton :repeat="3" size="small" />
          </div>

          <UiAlert v-else-if="slotsResult?.type === 'request_only'" type="warning">
            Суммарная длительность не помещается в рабочий день. Выберите услуги покороче или другую дату.
          </UiAlert>

          <UiAlert
            v-else-if="slotsResult?.type === 'slots' && slotsResult.entries.length === 0"
            type="info"
          >
            Свободных вариантов на эту дату нет. Попробуйте другую дату или измените исполнителей.
          </UiAlert>

          <div v-else-if="slotsResult?.type === 'slots'" class="slots-grid">
            <NTooltip
              v-for="entry in slotsResult.entries"
              :key="entry.startTime"
              trigger="hover"
              placement="top"
            >
              <template #trigger>
                <UiChip
                  :type="entry.match === 'preferred' ? 'success' : 'warning'"
                  :selected="selectedSlotEntry?.startTime === entry.startTime"
                  @click="selectedSlotEntry = entry"
                >
                  {{ entry.startTime }}
                </UiChip>
              </template>
              <div class="slot-tooltip">
                <div
                  v-for="(s, i) in entry.schedule"
                  :key="i"
                  class="slot-tooltip-row"
                >
                  <strong>{{ s.startTime }}</strong>
                  — {{ serviceNameById(s.serviceId) }}
                  ({{ s.resourceName }}<template v-if="s.preferredResourceId && s.preferredResourceId !== s.resourceId">
                    — вместо {{ s.preferredResourceName ?? '—' }}
                  </template>)
                </div>
              </div>
            </NTooltip>
          </div>
        </div>
      </template>

      <UiText v-else size="small" class="muted">
        {{ readOnlyDateText || '—' }}
      </UiText>
    </UiCard>

    <UiCard v-if="selectedSlotEntry">
      <UiTitle size="h4" class="card-title">Расписание визита</UiTitle>
      <div class="schedule-list">
        <div
          v-for="(s, i) in selectedSlotEntry.schedule"
          :key="i"
          class="schedule-row"
        >
          <UiText size="small" class="schedule-time">
            {{ s.startTime }}–{{ s.endTime }}
          </UiText>
          <div class="schedule-info">
            <UiText class="schedule-name">{{ serviceNameById(s.serviceId) }}</UiText>
            <div class="schedule-master">
              <template v-if="s.preferredResourceId && s.preferredResourceId !== s.resourceId">
                <UiText size="small" class="master-replaced">
                  {{ s.preferredResourceName ?? '—' }}
                </UiText>
                <UiText size="small" class="muted">→</UiText>
                <UiText size="small">{{ s.resourceName }}</UiText>
              </template>
              <UiText v-else size="small" class="muted">{{ s.resourceName }}</UiText>
            </div>
          </div>
        </div>
      </div>
      <UiAlert
        v-if="selectedSlotEntry.match === 'any'"
        type="warning"
        class="schedule-warning"
      >
        На это время предпочтительный мастер недоступен — подобрана замена.
      </UiAlert>
      <div class="schedule-totals">
        <UiText size="small" class="muted">
          Итого: {{ formatMinutes(totals.duration) }} — {{ formatPrice(totals.price) }}
        </UiText>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import {
  UiCard, UiTitle, UiText, UiAlert, UiChip, UiSkeleton, UiDatepicker,
} from '@fastio/ui'
import { NTooltip } from 'naive-ui'
import type { GroupSlotEntry, GroupSlotsResult } from '@fastio/shared'
import { formatPrice, formatMinutes } from '@fastio/shared'

defineProps<{
  isReadOnly: boolean
  saving: boolean
  hasDate: boolean
  activeServicesCount: number
  loadingSlots: boolean
  slotsResult: GroupSlotsResult | null
  totals: { duration: number; price: number }
  readOnlyDateText: string
  serviceNameById: (serviceId: string) => string
}>()

const dateTs = defineModel<number | null>('dateTs', { required: true })
const selectedSlotEntry = defineModel<GroupSlotEntry | null>('selectedSlotEntry', { required: true })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.slot-picker-root {
  @include flex-col(var(--space-16));
}

.card-title {
  margin-bottom: var(--space-12);
}

.muted {
  color: var(--color-text-secondary);
}

.slots-section {
  @include flex-col(var(--space-12));
  margin-top: var(--space-12);
}

.slots-loading {
  @include flex-col(var(--space-8));
}

.slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: var(--space-8);
}

.slot-tooltip {
  @include flex-col(var(--space-4));
  max-width: 280px;
}

.slot-tooltip-row {
  font-size: var(--font-size-xs);
  line-height: var(--line-height-tight);
}

.schedule-list {
  @include flex-col(var(--space-8));
}

.schedule-row {
  display: flex;
  gap: var(--space-12);
  align-items: flex-start;
  padding-bottom: var(--space-8);

  & + & {
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-8);
  }
}

.schedule-time {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
  min-width: 96px;
}

.schedule-info {
  @include flex-col(var(--space-4));
  flex: 1;
  min-width: 0;
}

.schedule-name {
  font-weight: var(--font-weight-medium);
}

.schedule-master {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
}

.master-replaced {
  text-decoration: line-through;
  color: var(--color-text-secondary);
}

.schedule-warning {
  margin-top: var(--space-12);
}

.schedule-totals {
  margin-top: var(--space-12);
  padding-top: var(--space-8);
  border-top: 1px solid var(--color-border);
}
</style>
