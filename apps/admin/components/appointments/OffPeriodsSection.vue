<template>
  <div class="off-periods-section-root">
    <UiTitle size="h5">Отпуска и отсутствия</UiTitle>

    <UiAlert
      v-for="period in currentOffPeriods"
      :key="`current-${period.from}`"
      type="warning"
      size="small"
      class="off-current"
    >
      <div class="off-current-row">
        <span><strong>Сейчас отсутствует:</strong> {{ formatPeriod(period) }} ({{ periodDaysLabel(period) }})</span>
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
        :key="period.from"
        class="override-row"
      >
        <div class="override-info">
          <UiText size="small" weight="medium">{{ formatPeriod(period) }}</UiText>
          <UiText size="tiny" class="hint">{{ periodDaysLabel(period) }}</UiText>
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
import { UiTitle, UiText, UiButton, UiAlert, UiDatepicker, useConfirm, useMessage } from '@fastio/ui'
import type { Resource, ResourceDateOverride } from '@fastio/shared'
import { pluralize, formatDate, datesInRange, addDaysToDateStr, todayInTz, utcIsoToLocalDateTime, localDateTimeToUtcIso, dateStrToTs } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useDatabase } from '~/composables/data/useDatabase'
import { reportError } from '~/utils/reportError'

const props = defineProps<{
  resource: Resource
}>()

const tenantStore = useTenantStore()
const api = useDatabase()
const { confirm } = useConfirm()
const message = useMessage()

const dateOverrides = ref<ResourceDateOverride[]>([])

type OffPeriod = { from: string; to: string }

const offForm = reactive({
  from: null as number | null,
  to: null as number | null,
})
const editingPeriod = ref<OffPeriod | null>(null)

// Дата timestamp'а В ТАЙМЗОНЕ ТЕНАНТА. `.toISOString().slice(0,10)` сдвигает
// на сутки около полуночи для тенантов с большим offset (Asia/Tokyo,
// Pacific/Auckland) — поэтому идём через утилиту, опирающуюся на Intl.DateTimeFormat.
const tsToDateStr = (ts: number | null): string | null => {
  if (!ts) return null

  return utcIsoToLocalDateTime(new Date(ts).toISOString(), tenantStore.tenant.timezone).dateStr
}

const formatPeriod = (p: OffPeriod): string => p.from === p.to ? formatDate(p.from) : `${formatDate(p.from)} — ${formatDate(p.to)}`

// Сравнение по локальному дню браузера: кросс-tz нюансы (тенант vs админ)
// не критичны — выходные дни про календарные числа, а не про время.
const startOfLocalDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

const isDateBeforeToday = (ts: number): boolean => startOfLocalDay(new Date(ts)) < startOfLocalDay(new Date())

type PeriodState = 'past' | 'current' | 'future'

const periodState = (p: OffPeriod): PeriodState => {
  const t = todayInTz(tenantStore.tenant.timezone)

  if (p.to < t) return 'past'
  if (p.from > t) return 'future'

  return 'current'
}

const periodDaysLabel = (p: OffPeriod): string => {
  const from = new Date(p.from + 'T00:00:00').getTime()
  const to = new Date(p.to + 'T00:00:00').getTime()
  const days = Math.round((to - from) / 86_400_000) + 1

  return `${days} дн.`
}

const offPeriods = computed<OffPeriod[]>(() => {
  const offDates = dateOverrides.value
    .filter((o) => !o.isWorking)
    .map((o) => o.date)
    .sort()

  if (!offDates.length) return []

  const periods: OffPeriod[] = []
  let from = offDates[0]
  let prev = offDates[0]

  for (let i = 1; i < offDates.length; i++) {
    const cur = offDates[i]

    if (cur === addDaysToDateStr(prev, 1)) {
      prev = cur
    } else {
      periods.push({ from, to: prev })
      from = cur
      prev = cur
    }
  }
  periods.push({ from, to: prev })

  const order: Record<PeriodState, number> = { current: 0, future: 1, past: 2 }

  return periods.sort((a, b) => {
    const sa = periodState(a)
    const sb = periodState(b)

    if (sa !== sb) return order[sa] - order[sb]
    if (sa === 'past') return b.from.localeCompare(a.from)

    return a.from.localeCompare(b.from)
  })
})

const canAddOff = computed(() => {
  if (!offForm.from) return false
  const to = offForm.to ?? offForm.from

  return to >= offForm.from
})

const currentOffPeriods = computed(() => offPeriods.value.filter((p) => periodState(p) === 'current'))
const futureOffPeriods = computed(() => offPeriods.value.filter((p) => periodState(p) === 'future'))

const loadDateOverrides = async () => {
  dateOverrides.value = await api.resources.getDateOverrides(props.resource.id)
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
    if (editingPeriod.value) {
      await Promise.all(
        datesInRange(editingPeriod.value.from, editingPeriod.value.to)
          .map((date) => api.resources.removeDateOverride(props.resource.id, date)),
      )
    }
    await Promise.all(
      datesInRange(fromStr, toStr)
        .map((date) => api.resources.upsertDateOverride(props.resource.id, date, false, null, null)),
    )
    await loadDateOverrides()
    editingPeriod.value = null
    offForm.from = null
    offForm.to = null
  } catch (e) {
    reportError(e)
    message.error('Не удалось сохранить отсутствие')
    await loadDateOverrides()
  }
}

const removeOffPeriod = async (period: OffPeriod) => {
  const ok = await confirm({
    title: 'Отменить отсутствие?',
    message: `${formatPeriod(period)} — ${periodDaysLabel(period)}`,
    confirmText: 'Отменить',
    cancelText: 'Не отменять',
  })

  if (!ok) return

  await Promise.all(
    datesInRange(period.from, period.to)
      .map((date) => api.resources.removeDateOverride(props.resource.id, date)),
  )
  await loadDateOverrides()
}

const startEdit = (period: OffPeriod) => {
  editingPeriod.value = period
  offForm.from = dateStrToTs(period.from)
  offForm.to = dateStrToTs(period.to)
}

const cancelEdit = () => {
  editingPeriod.value = null
  offForm.from = null
  offForm.to = null
}

watch(() => props.resource.id, loadDateOverrides, { immediate: true })

defineExpose({ reload: loadDateOverrides })
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

.off-current {
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
