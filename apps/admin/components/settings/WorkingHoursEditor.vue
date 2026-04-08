<template>
  <div class="hours-editor-root">
    <UiCheckbox v-model="state.allDay">Круглосуточно</UiCheckbox>

    <template v-if="!state.allDay">
      <div class="hours-default">
        <UiTimepicker v-model="state.open" label="Открытие" />
        <UiTimepicker v-model="state.close" label="Закрытие" />
      </div>

      <UiCheckbox v-model="state.useCustomDays">Разное время по дням</UiCheckbox>

      <div v-if="state.useCustomDays" class="days-grid">
        <div v-for="day in DAYS" :key="day.key" class="day-row">
          <span class="day-name">{{ day.label }}</span>
          <template v-if="!state.days[day.key].dayOff">
            <UiTimepicker v-model="state.days[day.key].open" />
            <UiTimepicker v-model="state.days[day.key].close" />
          </template>
          <span v-else class="day-off-label">Выходной</span>
          <UiCheckbox v-model="state.days[day.key].dayOff" class="day-off-toggle">Вых.</UiCheckbox>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { UiTimepicker, UiCheckbox } from '@fastio/ui'
import type { WorkingHoursSchedule } from '@fastio/shared'

const DAYS = [
  { key: '1', label: 'Пн' },
  { key: '2', label: 'Вт' },
  { key: '3', label: 'Ср' },
  { key: '4', label: 'Чт' },
  { key: '5', label: 'Пт' },
  { key: '6', label: 'Сб' },
  { key: '7', label: 'Вс' },
]

const props = defineProps<{ modelValue: WorkingHoursSchedule }>()
const emit = defineEmits<{ 'update:modelValue': [WorkingHoursSchedule] }>()

const buildDays = (s: WorkingHoursSchedule) => Object.fromEntries(DAYS.map((d) => {
  const override = s.days[d.key]

  return [d.key, {
    open: override?.open ?? s.default.open,
    close: override?.close ?? s.default.close,
    dayOff: override?.dayOff ?? false,
  }]
}))

const state = reactive({
  allDay: !!props.modelValue.default.allDay,
  open: props.modelValue.default.open,
  close: props.modelValue.default.close,
  useCustomDays: Object.keys(props.modelValue.days).length > 0,
  days: buildDays(props.modelValue),
})

let syncing = false

watch(() => props.modelValue, (val) => {
  syncing = true
  state.allDay = !!val.default.allDay
  state.open = val.default.open
  state.close = val.default.close
  state.useCustomDays = Object.keys(val.days).length > 0
  Object.assign(state.days, buildDays(val))
  syncing = false
}, { deep: true })

watch(state, () => {
  if (syncing) return

  if (state.allDay) {
    emit('update:modelValue', { default: { open: state.open, close: state.close, allDay: true }, days: {} })

    return
  }

  const days: WorkingHoursSchedule['days'] = {}

  if (state.useCustomDays) {
    for (const day of DAYS) {
      const d = state.days[day.key]

      days[day.key] = d.dayOff
        ? { open: d.open, close: d.close, dayOff: true }
        : { open: d.open, close: d.close }
    }
  }
  emit('update:modelValue', { default: { open: state.open, close: state.close }, days })
}, { deep: true, flush: 'sync' })
</script>

<style scoped lang="scss">
.hours-editor-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hours-default {
  display: flex;
  align-items: flex-end;
  gap: 14px;
}

.days-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.day-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.day-name {
  width: 24px;
  font-size: 13px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.day-off-label {
  font-size: 13px;
  color: var(--color-text-muted);
  flex: 1;
}

.day-off-toggle {
  flex-shrink: 0;
}
</style>
