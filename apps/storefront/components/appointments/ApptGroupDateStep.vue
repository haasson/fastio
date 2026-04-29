<template>
  <div class="date-step-root">
    <!-- Week nav -->
    <div class="date-nav">
      <button class="nav-btn" :disabled="!canGoPrev" @click="prevWeek">
        <ChevronLeft :size="18" />
      </button>
      <span class="week-label">{{ weekLabel }}</span>
      <button class="nav-btn" :disabled="!canGoNext" @click="nextWeek">
        <ChevronRight :size="18" />
      </button>
    </div>

    <!-- Days strip -->
    <div class="dates-row">
      <button
        v-for="day in visibleDays"
        :key="day.date"
        class="date-btn"
        :class="{
          selected: selectedDate === day.date,
          today: day.isToday,
          disabled: day.isDisabled,
        }"
        :disabled="day.isDisabled"
        @click="emit('update:selectedDate', day.date)"
      >
        <span class="day-name">{{ day.dayName }}</span>
        <span class="day-num">{{ day.dayNum }}</span>
        <span
          class="day-dot"
          :class="dotClass(day.match)"
        />
      </button>
    </div>

    <!-- Legend -->
    <div class="legend">
      <span class="legend-item"><span class="legend-dot dot-green" />по выбору</span>
      <span class="legend-item"><span class="legend-dot dot-yellow" />с заменой</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { todayInTz, addDaysToDateStr, DEFAULT_TIMEZONE } from '@fastio/shared'
import type { GroupSlotMatch } from '@fastio/shared'

const props = withDefaults(defineProps<{
  selectedDate: string | null
  horizonDays: number
  weekMatches: Record<string, GroupSlotMatch | null>
  // Tz тенанта — нужна, чтобы "сегодня" совпадало с тем, что считают
  // /api/appointments/group-slots и group-week. Дефолт — Москва, как фолбэк
  // на ранний рендер до загрузки tenant.
  timezone?: string
}>(), { timezone: DEFAULT_TIMEZONE })

const emit = defineEmits<{
  'update:selectedDate': [date: string]
  'fetch-week': [dates: string[]]
}>()

const weekOffset = ref(0)

const today = computed(() => todayInTz(props.timezone))

const maxDate = computed(() => addDaysToDateStr(today.value, props.horizonDays))

const DAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const visibleDays = computed(() => {
  const startDate = addDaysToDateStr(today.value, weekOffset.value * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDaysToDateStr(startDate, i)
    // Полдень — устойчивый момент времени для извлечения dayOfWeek/dayNum
    // в любой tz: ни DST, ни пограничные офсеты не сдвинут на сутки.
    const d = new Date(dateStr + 'T12:00:00')
    const isDisabled = dateStr < today.value || dateStr > maxDate.value
    return {
      date: dateStr,
      dayName: DAYS_SHORT[d.getDay()],
      dayNum: d.getDate(),
      isToday: dateStr === today.value,
      isDisabled,
      match: isDisabled ? null : (props.weekMatches[dateStr] ?? null),
    }
  })
})

const weekLabel = computed(() => {
  const first = visibleDays.value[0]
  const last = visibleDays.value[6]
  const fmt = (s: string) => {
    const d = new Date(s + 'T12:00:00')
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`
  }
  return `${fmt(first.date)} — ${fmt(last.date)}`
})

const canGoPrev = computed(() => weekOffset.value > 0)
const canGoNext = computed(() => {
  const lastDay = visibleDays.value[6].date
  return lastDay < maxDate.value
})

const prevWeek = () => { if (canGoPrev.value) weekOffset.value-- }
const nextWeek = () => { if (canGoNext.value) weekOffset.value++ }

const dotClass = (match: GroupSlotMatch | null): string => {
  if (match === 'preferred') return 'dot-green'
  if (match === 'any') return 'dot-yellow'
  return 'dot-empty'
}

// Запрашиваем выборку по неделе при смене окна (включая старт)
watch(visibleDays, (days) => {
  const datesToFetch = days
    .filter(d => !d.isDisabled)
    .map(d => d.date)
  if (datesToFetch.length > 0) emit('fetch-week', datesToFetch)
}, { immediate: true })
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.date-step-root {
  @include flex-col(16px);
}

.date-nav {
  @include flex-between;
  gap: 8px;
}

.week-label {
  @include text-xs;
  color: var(--color-text-secondary);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  cursor: pointer;
  color: var(--color-text);
  transition: opacity 0.15s;

  &:disabled { opacity: 0.35; cursor: default; }
  &:not(:disabled):hover { background: var(--surface-hover); }
}

.dates-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.date-btn {
  position: relative;
  @include flex-col(2px);
  align-items: center;
  padding: 8px 4px 14px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(.disabled):not(.selected) {
    background: var(--surface-hover);
  }

  &.today .day-num {
    color: var(--primary);
    font-weight: 600;
  }

  &.selected {
    border-color: var(--primary);
    background: color-mix(in srgb, var(--primary) 8%, transparent);
  }

  &.disabled {
    opacity: 0.35;
    cursor: default;
  }
}

.day-name {
  @include text-micro(400);
  color: var(--color-text-muted);
}

.day-num {
  @include text-caption(500);
  color: var(--color-text);
}

.day-dot {
  position: absolute;
  bottom: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;

  &.dot-green { background: var(--color-success); }
  &.dot-yellow { background: var(--color-warning); }
  &.dot-empty { background: transparent; }
}

.legend {
  @include flex-row(12px);
  flex-wrap: wrap;
}

.legend-item {
  @include flex-row(6px);
  @include text-xs;
  color: var(--color-text-muted);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.dot-green { background: var(--color-success); }
  &.dot-yellow { background: var(--color-warning); }
}
</style>
