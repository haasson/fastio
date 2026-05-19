<template>
  <div class="hours-editor-root">
    <label class="toggle-row">
      <UiSwitch v-model="state.allDay" size="small" />
      <UiText size="small">Круглосуточно</UiText>
    </label>

    <template v-if="!state.allDay">
      <div class="hours-default">
        <UiTimepicker v-model="state.open" label="Открытие" />
        <UiTimepicker v-model="state.close" label="Закрытие" />
      </div>

      <label class="toggle-row">
        <UiSwitch v-model="state.useCustomDays" size="small" />
        <UiText size="small">Разное время по дням</UiText>
      </label>

      <div v-if="state.useCustomDays" class="days-grid">
        <div v-for="day in DAYS" :key="day.key" class="day-row">
          <UiSwitch v-model="state.days[day.key].enabled" size="small" />
          <span class="day-name">{{ day.label }}</span>
          <template v-if="state.days[day.key].enabled">
            <UiTimepicker v-model="state.days[day.key].open" />
            <UiTimepicker v-model="state.days[day.key].close" />
          </template>
          <span v-else class="day-off-label">Выходной</span>
        </div>
      </div>

      <!-- Особые дни -->
      <div class="exceptions-section">
        <UiText size="small" secondary>Особые даты</UiText>

        <div class="add-form">
          <div class="date-wrap">
            <UiDatepicker v-model="newEntry.timestamp" label="Дата" />
          </div>
          <label class="toggle-row">
            <UiSwitch v-model="newEntry.dayOff" size="small" />
            <UiText size="small">Весь день выходной</UiText>
          </label>
          <div v-if="!newEntry.dayOff" class="hours-default">
            <UiTimepicker v-model="newEntry.open" label="Открытие" />
            <UiTimepicker v-model="newEntry.close" label="Закрытие" />
          </div>
          <label class="toggle-row">
            <UiSwitch v-model="newEntry.recurring" size="small" />
            <UiText size="small">Повторять ежегодно</UiText>
          </label>
          <UiButton
            size="small"
            type="primary"
            :disabled="!newEntry.timestamp"
            @click="addException"
          >Добавить</UiButton>
        </div>

        <template v-if="visibleChips.length > 0">
          <div class="chips-wrap">
            <div
              v-for="chip in visibleChips"
              :key="chip.chipKey"
              class="exception-chip"
              :class="chip.dayOff ? 'chip--error' : 'chip--warning'"
            >
              <span class="chip-label">{{ chipDateLabel(chip.dateStr, chip.isRecurring) }}</span>
              <span class="chip-sub">{{ chip.dayOff ? 'Выходной' : `${chip.open} – ${chip.close}` }}</span>
              <span v-if="chip.isRecurring" class="chip-recurring">Ежегодно</span>
              <UiChipRemove @click="removeException(chip.key)" />
            </div>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from 'vue'
import { UiTimepicker, UiSwitch, UiText, UiButton, UiDatepicker, UiChipRemove } from '@fastio/ui'
import type { WorkingHoursSchedule, ScheduleException } from '@fastio/shared'

const DAYS = [
  { key: '1', label: 'Пн' },
  { key: '2', label: 'Вт' },
  { key: '3', label: 'Ср' },
  { key: '4', label: 'Чт' },
  { key: '5', label: 'Пт' },
  { key: '6', label: 'Сб' },
  { key: '7', label: 'Вс' },
]

type ExEntry = {
  key: string // "YYYY-MM-DD" or "--MM-DD" for recurring
  dayOff: boolean
  open: string
  close: string
}

type ChipEntry = ExEntry & {
  dateStr: string // actual occurrence date for sorting/display
  isRecurring: boolean
  chipKey: string
}

const props = defineProps<{ modelValue: WorkingHoursSchedule }>()
const emit = defineEmits<{ 'update:modelValue': [WorkingHoursSchedule] }>()

const buildDays = (s: WorkingHoursSchedule) => Object.fromEntries(DAYS.map((d) => {
  const override = s.days[d.key]

  return [d.key, {
    open: override?.open ?? s.default.open,
    close: override?.close ?? s.default.close,
    enabled: !(override?.dayOff ?? false),
  }]
}))

const state = reactive({
  allDay: !!props.modelValue.default.allDay,
  open: props.modelValue.default.open,
  close: props.modelValue.default.close,
  useCustomDays: Object.keys(props.modelValue.days).length > 0,
  days: buildDays(props.modelValue),
})

function todayMidnight(): Date {
  const d = new Date()

  d.setHours(0, 0, 0, 0)

  return d
}

const buildExceptions = (s: WorkingHoursSchedule): ExEntry[] => {
  const result: ExEntry[] = []

  for (const [k, v] of Object.entries(s.exceptions ?? {})) {
    result.push({ key: k, dayOff: !!v.dayOff, open: v.open, close: v.close })
  }
  for (const [k, v] of Object.entries(s.recurringExceptions ?? {})) {
    result.push({ key: k, dayOff: !!v.dayOff, open: v.open, close: v.close })
  }

  return result
}

const exceptionList = ref<ExEntry[]>(buildExceptions(props.modelValue))

const newEntry = reactive({
  timestamp: null as number | null,
  dayOff: true,
  open: '10:00',
  close: '18:00',
  recurring: false,
})

function resetNewEntry() {
  newEntry.timestamp = null
  newEntry.dayOff = true
  newEntry.open = '10:00'
  newEntry.close = '18:00'
  newEntry.recurring = false
}

function timestampToDateStr(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${y}-${m}-${day}`
}

function addException() {
  if (!newEntry.timestamp) return
  const dateStr = timestampToDateStr(newEntry.timestamp)
  const key = newEntry.recurring ? `--${dateStr.slice(5)}` : dateStr

  const entry: ExEntry = { key, dayOff: newEntry.dayOff, open: newEntry.open, close: newEntry.close }
  const idx = exceptionList.value.findIndex((e) => e.key === key)

  if (idx >= 0) exceptionList.value[idx] = entry
  else exceptionList.value.push(entry)

  emitValue()
  resetNewEntry()
}

function removeException(key: string) {
  exceptionList.value = exceptionList.value.filter((e) => e.key !== key)
  emitValue()
}

const visibleChips = computed((): ChipEntry[] => {
  const today = todayMidnight()
  const cutoff = new Date(today)

  cutoff.setMonth(cutoff.getMonth() + 12)
  const thisYear = today.getFullYear()
  const result: ChipEntry[] = []

  for (const entry of exceptionList.value) {
    if (entry.key.startsWith('--')) {
      const mmdd = entry.key.slice(2)

      for (const year of [thisYear, thisYear + 1]) {
        const dateStr = `${year}-${mmdd}`
        const d = new Date(`${dateStr}T00:00:00`)

        if (d >= today && d <= cutoff) {
          result.push({ ...entry, dateStr, isRecurring: true, chipKey: `${entry.key}-${year}` })
          break
        }
      }
    } else {
      const d = new Date(`${entry.key}T00:00:00`)

      if (d >= today && d <= cutoff) {
        result.push({ ...entry, dateStr: entry.key, isRecurring: false, chipKey: entry.key })
      }
    }
  }

  return result.sort((a, b) => a.dateStr.localeCompare(b.dateStr))
})

function chipDateLabel(dateStr: string, isRecurring: boolean): string {
  const d = new Date(`${dateStr}T00:00:00`)
  const currentYear = new Date().getFullYear()
  const showYear = !isRecurring && d.getFullYear() !== currentYear

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    ...(showYear ? { year: 'numeric' } : {}),
  }).format(d)
}

let syncing = false

function buildExceptionsOutput(): Pick<WorkingHoursSchedule, 'exceptions' | 'recurringExceptions'> {
  const exceptions: Record<string, ScheduleException> = {}
  const recurringExceptions: Record<string, ScheduleException> = {}

  for (const entry of exceptionList.value) {
    const wh: ScheduleException = entry.dayOff
      ? { open: entry.open, close: entry.close, dayOff: true }
      : { open: entry.open, close: entry.close }

    if (entry.key.startsWith('--')) {
      recurringExceptions[entry.key] = wh
    } else {
      exceptions[entry.key] = wh
    }
  }

  return {
    exceptions: Object.keys(exceptions).length > 0 ? exceptions : undefined,
    recurringExceptions: Object.keys(recurringExceptions).length > 0 ? recurringExceptions : undefined,
  }
}

function emitValue() {
  if (syncing) return

  if (state.allDay) {
    emit('update:modelValue', { default: { open: state.open, close: state.close, allDay: true }, days: {}, ...buildExceptionsOutput() })

    return
  }

  const days: WorkingHoursSchedule['days'] = {}

  if (state.useCustomDays) {
    for (const day of DAYS) {
      const d = state.days[day.key]

      days[day.key] = d.enabled
        ? { open: d.open, close: d.close }
        : { open: d.open, close: d.close, dayOff: true }
    }
  }

  emit('update:modelValue', { default: { open: state.open, close: state.close }, days, ...buildExceptionsOutput() })
}

watch(() => props.modelValue, (val) => {
  syncing = true
  state.allDay = !!val.default.allDay
  state.open = val.default.open
  state.close = val.default.close
  state.useCustomDays = Object.keys(val.days).length > 0
  Object.assign(state.days, buildDays(val))
  exceptionList.value = buildExceptions(val)
  syncing = false
}, { deep: true })

watch(state, () => emitValue(), { deep: true, flush: 'sync' })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.hours-editor-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  cursor: pointer;
  width: fit-content;
}

.hours-default {
  display: flex;
  align-items: flex-end;
  gap: var(--space-12);
}

.days-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  max-width: 360px;
}

.day-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.day-name {
  width: 24px;
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.day-off-label {
  font-size: var(--font-size-base);
  color: var(--color-text-hint);
}

// ─── Exceptions ───────────────────────────────────────────────────────────────

.exceptions-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding-top: var(--space-12);
  border-top: 1px solid var(--color-border);
}

.add-form {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-12);
  padding: var(--space-12);
  background: var(--color-bg-subtle);
  border-radius: var(--radius-8);
}

.date-wrap {
  width: 180px;
}

// ─── Chips ────────────────────────────────────────────────────────────────────

.chips-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

.exception-chip {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-8);
  padding-right: var(--space-20);
  border-radius: var(--radius-8);
  border: 1.5px solid var(--ex-border);
  background: var(--ex-bg);
  transition: border-color var(--transition-fast);

  &:hover {
    border-color: var(--ex-accent);

    :deep(.ui-chip-remove) {
      opacity: 1;
    }
  }

  &.chip--error {
    --ex-bg: var(--color-error-light);
    --ex-border: color-mix(in srgb, var(--color-error) 20%, transparent);
    --ex-accent: var(--color-error);
  }

  &.chip--warning {
    --ex-bg: var(--color-warning-light);
    --ex-border: color-mix(in srgb, var(--color-warning) 20%, transparent);
    --ex-accent: var(--color-warning);
  }
}

.chip-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text);
  line-height: var(--line-height-tight);
  white-space: nowrap;
}

.chip-sub {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: var(--line-height-tight);
}

.chip-recurring {
  display: inline-block;
  margin-top: var(--space-4);
  padding: 1px var(--space-4);
  border-radius: var(--radius-4);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  background: color-mix(in srgb, var(--ex-accent) 15%, transparent);
  color: var(--ex-accent);
}

// Absolute floating × hidden by default, shown on .exception-chip hover. Стили самого ×-button — в UiChipRemove.
.exception-chip :deep(.ui-chip-remove) {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  opacity: 0;
  // opacity для show/hide на hover родителя + сохраняем background/color transitions из UiChipRemove.
  transition:
    opacity var(--transition-fast),
    background var(--transition-fast),
    color var(--transition-fast);
}

</style>
