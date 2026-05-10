<template>
  <div class="off-periods-section-root">
    <UiTitle size="h5">Отпуска и отсутствия</UiTitle>

    <UiAlert
      v-for="period in currentOffPeriods"
      :key="`current-${period.id}`"
      type="warning"
      size="small"
    >
      <div class="off-current-row">
        <UiText size="small" span>
          <strong>{{ RESOURCE_UNAVAILABILITY_REASON_LABELS[period.reason] }}:</strong>
          {{ formatPeriod(period) }} ({{ periodDaysLabel(period) }})<span v-if="period.notes" class="hint"> — {{ period.notes }}</span>
        </UiText>
        <div class="off-current-actions">
          <UiButton
            size="tiny"
            type="text"
            icon="edit"
            :disabled="editingPeriod !== null"
            @click="startEdit(period)"
          />
          <UiButton
            size="tiny"
            type="text"
            icon="trash"
            :disabled="editingPeriod !== null"
            @click="removeOffPeriod(period)"
          />
        </div>
      </div>
    </UiAlert>

    <div v-if="futureOffPeriods.length" class="overrides-list">
      <UiText size="small" weight="medium" class="overrides-label">Запланировано</UiText>
      <div
        v-for="period in futureOffPeriods"
        :key="period.id"
        class="override-row"
      >
        <div class="override-info">
          <UiText size="small" weight="medium">
            {{ RESOURCE_UNAVAILABILITY_REASON_LABELS[period.reason] }} · {{ formatPeriod(period) }}
          </UiText>
          <UiText size="tiny" class="hint">
            {{ periodDaysLabel(period) }}<span v-if="period.notes"> · {{ period.notes }}</span>
          </UiText>
        </div>
        <div class="override-actions">
          <UiButton
            size="tiny"
            type="text"
            icon="edit"
            :disabled="editingPeriod !== null"
            @click="startEdit(period)"
          />
          <UiButton
            size="tiny"
            type="text"
            icon="trash"
            :disabled="editingPeriod !== null"
            @click="removeOffPeriod(period)"
          />
        </div>
      </div>
    </div>

    <div class="overrides-form">
      <UiDatepicker
        v-model="offForm.from"
        placeholder="С"
        size="small"
        class="override-date"
        :is-date-disabled="isDateBeforeToday"
      />
      <span class="time-sep">—</span>
      <UiDatepicker
        v-model="offForm.to"
        placeholder="По"
        size="small"
        class="override-date"
        :is-date-disabled="isDateBeforeToday"
      />
      <UiSelect
        v-model:value="offForm.reason"
        :options="RESOURCE_UNAVAILABILITY_REASON_OPTIONS"
        size="small"
        class="override-reason"
      />
      <UiInput
        v-model="offForm.notes"
        placeholder="Комментарий (необязательно)"
        size="small"
        class="override-notes"
      />
      <UiButton
        size="small"
        type="primary"
        :disabled="!canAddOff"
        @click="addOffPeriod"
      >
        {{ editingPeriod ? 'Сохранить' : 'Добавить' }}
      </UiButton>
      <UiButton
        v-if="editingPeriod"
        size="small"
        type="text"
        @click="cancelEdit"
      >
        Отмена
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiTitle, UiText, UiButton, UiAlert, UiDatepicker, UiSelect, UiInput, useConfirm, useMessage } from '@fastio/ui'
import type { Resource, ResourceUnavailability, ResourceUnavailabilityReason } from '@fastio/shared'
import {
  pluralize, formatDate, addDaysToDateStr, todayInTz,
  utcIsoToLocalDateTime, localDateTimeToUtcIso,
  RESOURCE_UNAVAILABILITY_REASON_LABELS, RESOURCE_UNAVAILABILITY_REASON_OPTIONS,
} from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/composables/data/useDatabase'
import { reportError } from '~/utils/reportError'

const props = defineProps<{
  resource: Resource
}>()

const tenantStore = useTenantStore()
const api = useDatabase()
const { confirm } = useConfirm()
const message = useMessage()

const periods = ref<ResourceUnavailability[]>([])

const offForm = reactive({
  from: null as number | null,
  to: null as number | null,
  reason: 'vacation' as ResourceUnavailabilityReason,
  notes: '',
})
const editingPeriod = ref<ResourceUnavailability | null>(null)

// Все ts-операции идут через tenant tz: формируем ts как midnight tenant-tz и
// читаем обратно через `utcIsoToLocalDateTime`. Без этого админ в чужой tz
// получал расхождение в день между записанным и отображаемым значением.
const dateStrToTs = (dateStr: string): number => new Date(
  localDateTimeToUtcIso(dateStr, '00:00', tenantStore.tenant.timezone),
).getTime()

const tsToDateStr = (ts: number | null): string | null => {
  if (!ts) return null

  return utcIsoToLocalDateTime(new Date(ts).toISOString(), tenantStore.tenant.timezone).dateStr
}

const formatPeriod = (p: ResourceUnavailability): string => p.dateFrom === p.dateTo
  ? formatDate(p.dateFrom)
  : `${formatDate(p.dateFrom)} — ${formatDate(p.dateTo)}`

// Сравнение по локальному дню браузера: кросс-tz нюансы (тенант vs админ)
// не критичны — выходные дни про календарные числа, а не про время.
const startOfLocalDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

const isDateBeforeToday = (ts: number): boolean => startOfLocalDay(new Date(ts)) < startOfLocalDay(new Date())

type PeriodState = 'past' | 'current' | 'future'

const periodState = (p: ResourceUnavailability): PeriodState => {
  const t = todayInTz(tenantStore.tenant.timezone)

  if (p.dateTo < t) return 'past'
  if (p.dateFrom > t) return 'future'

  return 'current'
}

const periodDaysLabel = (p: ResourceUnavailability): string => {
  const days = Math.round((dateStrToTs(p.dateTo) - dateStrToTs(p.dateFrom)) / 86_400_000) + 1

  return `${days} дн.`
}

const sortedPeriods = computed<ResourceUnavailability[]>(() => {
  const order: Record<PeriodState, number> = { current: 0, future: 1, past: 2 }

  return [...periods.value].sort((a, b) => {
    const sa = periodState(a)
    const sb = periodState(b)

    if (sa !== sb) return order[sa] - order[sb]
    if (sa === 'past') return b.dateFrom.localeCompare(a.dateFrom)

    return a.dateFrom.localeCompare(b.dateFrom)
  })
})

const canAddOff = computed(() => {
  if (!offForm.from) return false
  const to = offForm.to ?? offForm.from

  return to >= offForm.from
})

const currentOffPeriods = computed(() => sortedPeriods.value.filter((p) => periodState(p) === 'current'))
const futureOffPeriods = computed(() => sortedPeriods.value.filter((p) => periodState(p) === 'future'))

const loadPeriods = async () => {
  periods.value = await api.resourceUnavailability.listForResource(props.resource.id)
}

const addOffPeriod = async () => {
  if (!offForm.from) return
  const fromStr = tsToDateStr(offForm.from)
  const toStr = tsToDateStr(offForm.to ?? offForm.from)

  if (!fromStr || !toStr) return

  const tz = tenantStore.tenant.timezone
  const fromUtc = localDateTimeToUtcIso(fromStr, '00:00', tz)
  const toUtcExclusive = localDateTimeToUtcIso(addDaysToDateStr(toStr, 1), '00:00', tz)

  const conflicts = await api.appointments.listPaginated(tenantStore.currentTenantId!, {
    resourceId: props.resource.id,
    statuses: ['new', 'confirmed'],
    dateFrom: fromUtc,
    dateTo: toUtcExclusive,
    page: 1,
    pageSize: 50,
    sortDir: 'asc',
  })

  if (conflicts.total > 0) {
    const fmt = new Intl.DateTimeFormat('ru', {
      timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    const preview = conflicts.data.slice(0, 3)
      .map((a) => `${fmt.format(new Date(a.startsAt))} — ${a.customerName}`)
      .join('; ')
    const more = conflicts.total > 3 ? ` и ещё ${conflicts.total - 3}` : ''

    await confirm({
      title: `В этот период ${conflicts.total} ${pluralize(conflicts.total, 'запись', 'записи', 'записей')}`,
      message: 'Сначала перенесите их на другого исполнителя или другое время, потом ставьте отсутствие.',
      alert: `${preview}${more}`,
      confirmText: false,
      cancelText: 'Понятно',
    })

    return
  }

  try {
    const notes = offForm.notes.trim() || null

    if (editingPeriod.value) {
      await api.resourceUnavailability.update(editingPeriod.value.id, {
        dateFrom: fromStr,
        dateTo: toStr,
        reason: offForm.reason,
        notes,
      })
    } else {
      await api.resourceUnavailability.create(tenantStore.currentTenantId!, {
        resourceId: props.resource.id,
        dateFrom: fromStr,
        dateTo: toStr,
        reason: offForm.reason,
        notes,
      })
    }
    await loadPeriods()
    cancelEdit()
  } catch (e) {
    reportError(e)
    message.error('Не удалось сохранить отсутствие')
    await loadPeriods()
  }
}

const removeOffPeriod = async (period: ResourceUnavailability) => {
  const ok = await confirm({
    title: 'Отменить отсутствие?',
    message: `${formatPeriod(period)} — ${periodDaysLabel(period)}`,
    confirmText: 'Отменить',
    cancelText: 'Не отменять',
  })

  if (!ok) return

  await api.resourceUnavailability.remove(period.id)
  await loadPeriods()
}

const startEdit = (period: ResourceUnavailability) => {
  editingPeriod.value = period
  offForm.from = dateStrToTs(period.dateFrom)
  offForm.to = dateStrToTs(period.dateTo)
  offForm.reason = period.reason
  offForm.notes = period.notes ?? ''
}

const cancelEdit = () => {
  editingPeriod.value = null
  offForm.from = null
  offForm.to = null
  offForm.reason = 'vacation'
  offForm.notes = ''
}

watch(() => props.resource.id, loadPeriods, { immediate: true })

defineExpose({ reload: loadPeriods })
</script>

<style scoped lang="scss">
.off-periods-section-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.hint {
  color: var(--color-text-secondary);
}

.time-sep {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.overrides-form {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.override-date {
  width: 140px;
}

.override-reason {
  width: 140px;
}

.override-notes {
  flex: 1 1 200px;
  min-width: 200px;
}

.overrides-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.override-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-8);
  border-radius: var(--radius-8);
  background: var(--color-bg-subtle);
}

.override-info {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
  min-width: 0;
}

.override-actions {
  display: flex;
  gap: var(--space-4);
}

.overrides-label {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-4);
}

.off-current-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
  flex-wrap: wrap;
}

.off-current-actions {
  display: flex;
  gap: var(--space-4);
  flex-shrink: 0;
}
</style>
