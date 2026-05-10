<template>
  <UiModal
    :model-value="modelValue"
    :width="780"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="header">
        <div class="header-title">
          <UiTitle size="h3">{{ resource?.name ?? '' }}</UiTitle>
          <UiText size="small" class="hint">График работы</UiText>
        </div>

        <div class="month-nav">
          <UiButton
            size="small"
            icon="chevronLeft"
            @click="goPrev"
          />
          <button class="month-pill" :class="{ 'is-current': isCurrentMonth }" @click="goToday">
            <span class="month-name">{{ monthLabel }}</span>
            <span v-if="!isCurrentMonth" class="month-back">сегодня</span>
          </button>
          <UiButton
            size="small"
            icon="chevronRight"
            @click="goNext"
          />
        </div>
      </div>
    </template>

    <div class="grid">
      <div v-for="dow in dowLabels" :key="dow" class="dow-cell">{{ dow }}</div>

      <template v-for="cell in cells" :key="cell.key">
        <div v-if="cell.empty" class="cell-empty" />

        <UiCard
          v-else-if="loading || !cell.day"
          size="small"
          class="cell cell-loading"
        >
          <span class="day-num">{{ cell.dayNum }}</span>
          <span class="skeleton-bar" />
        </UiCard>

        <UiPopover
          v-else-if="cell.day.isWorking || cell.day.appointments.length > 0"
          trigger="click"
          :width="260"
          no-sheet
          :show="openCellKey === cell.key"
          @update:show="(v: boolean) => openCellKey = v ? cell.key : null"
        >
          <template #trigger>
            <UiCard
              size="small"
              clickable
              :selected="openCellKey === cell.key"
              class="cell"
              :class="{
                'cell-working': cell.day.isWorking,
                'cell-absence': cell.day.isAbsence,
                'cell-past': cell.past,
                'cell-today': cell.today,
              }"
            >
              <span class="day-num">{{ cell.dayNum }}</span>
              <span v-if="cell.day.isWorking" class="hours">{{ formatHours(cell.day) }}</span>
              <span v-else-if="cell.day.isAbsence" class="hours hours-absence">отпуск</span>
              <span v-else class="hours hours-off">—</span>

              <span v-if="cell.day.appointments.length" class="dots">
                <span
                  v-for="i in Math.min(cell.day.appointments.length, 4)"
                  :key="i"
                  class="dot"
                />
                <span v-if="cell.day.appointments.length > 4" class="dot-more">
                  +{{ cell.day.appointments.length - 4 }}
                </span>
              </span>
            </UiCard>
          </template>

          <div class="popover">
            <div class="popover-head">
              <UiText size="small" weight="medium">{{ formatDayTitle(cell.day.date) }}</UiText>
              <span v-if="cell.day.isWorking" class="hours-pill">
                <UiIcon name="clock" :size="14" />
                {{ formatHours(cell.day) }}
              </span>
              <span v-else-if="cell.day.isAbsence" class="hours-pill hours-pill-warning">
                <UiIcon name="calendar" :size="14" />
                Отпуск
              </span>
              <span v-else class="hours-pill hours-pill-muted">Выходной</span>
            </div>

            <UiDivider v-if="cell.day.appointments.length || cell.day.isWorking" />

            <div v-if="cell.day.appointments.length" class="apts">
              <div
                v-for="apt in cell.day.appointments"
                :key="apt.id"
                class="apt"
              >
                <span class="apt-time">{{ apt.startTimeLocal }}</span>
                <div class="apt-meta">
                  <UiText size="small" weight="medium">{{ apt.customerName }}</UiText>
                  <UiText size="tiny" class="apt-service">{{ apt.serviceName }}</UiText>
                </div>
              </div>
            </div>

            <div v-else-if="cell.day.isWorking" class="apts-empty">
              <UiIcon name="calendar" :size="16" />
              <UiText size="small">Записей нет</UiText>
            </div>
          </div>
        </UiPopover>

        <UiCard
          v-else
          size="small"
          class="cell cell-off"
          :class="{ 'cell-past': cell.past, 'cell-absence': cell.day.isAbsence, 'cell-today': cell.today }"
        >
          <span class="day-num">{{ cell.dayNum }}</span>
          <span v-if="cell.day.isAbsence" class="hours hours-absence">отпуск</span>
          <span v-else class="hours hours-off">—</span>
        </UiCard>
      </template>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiTitle, UiText, UiButton, UiCard, UiPopover, UiDivider } from '@fastio/ui'
import { UiIcon } from '@fastio/icons'
import type { Resource } from '@fastio/shared'
import { todayInTz } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useStaffMonthSchedule, type StaffMonthDay } from '../composables/useStaffMonthSchedule'

const tenantStore = useTenantStore()
const tz = computed(() => tenantStore.tenant.timezone)

const props = defineProps<{
  modelValue: boolean
  resource: Resource | null
}>()

defineEmits<{
  'update:modelValue': [boolean]
}>()

// Сегодняшняя дата в TZ тенанта, не браузера: иначе админ из другой зоны
// видит неверный «сегодня» в подсветке календаря.
const today = (): { year: number; month: number; day: number } => {
  const [y, m, d] = todayInTz(tz.value).split('-').map(Number)

  return { year: y, month: m - 1, day: d }
}

const monthAnchor = ref<{ year: number; month: number }>({ year: today().year, month: today().month })
const openCellKey = ref<string | null>(null)

watch(() => props.modelValue, (open) => {
  if (open) {
    const t = today()

    monthAnchor.value = { year: t.year, month: t.month }
  }
  openCellKey.value = null
})

watch(monthAnchor, () => {
  openCellKey.value = null
}, { deep: true })

const resourceRef = computed(() => props.resource)
const { loading, days } = useStaffMonthSchedule(resourceRef, monthAnchor)

const dowLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const monthLabel = computed(() => {
  const d = new Date(monthAnchor.value.year, monthAnchor.value.month, 1)
  const fmt = new Intl.DateTimeFormat('ru', { month: 'long', year: 'numeric' }).format(d)

  return fmt.replace(/^./, (c) => c.toUpperCase())
})

const isCurrentMonth = computed(() => {
  const t = today()

  return t.year === monthAnchor.value.year && t.month === monthAnchor.value.month
})

type Cell = {
  key: string
  empty: boolean
  dayNum?: number
  day?: StaffMonthDay
  past?: boolean
  today?: boolean
}

const todayStr = (): string => todayInTz(tz.value)

const cells = computed<Cell[]>(() => {
  const { year, month } = monthAnchor.value
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7
  const lastDay = new Date(year, month + 1, 0).getDate()
  const result: Cell[] = []
  const tStr = todayStr()

  for (let i = 0; i < firstDow; i++) {
    result.push({ key: `empty-${i}`, empty: true })
  }

  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const day = days.value.get(date)

    result.push({
      key: date,
      empty: false,
      dayNum: d,
      day,
      past: date < tStr,
      today: date === tStr,
    })
  }

  return result
})

const formatHours = (day: StaffMonthDay): string => {
  if (!day.openTime || !day.closeTime) return ''

  return `${day.openTime}–${day.closeTime}`
}

const formatDayTitle = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number)
  const fmt = new Intl.DateTimeFormat('ru', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(y, m - 1, d))

  return fmt.replace(/^./, (c) => c.toUpperCase())
}

const goPrev = () => {
  const { year, month } = monthAnchor.value

  monthAnchor.value = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
}

const goNext = () => {
  const { year, month } = monthAnchor.value

  monthAnchor.value = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
}

const goToday = () => {
  const t = today()

  monthAnchor.value = { year: t.year, month: t.month }
}
</script>

<style scoped lang="scss">
.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-16);
  flex-wrap: wrap;
  padding-right: var(--space-32);
}

.header-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hint {
  color: var(--color-text-secondary);
}

.month-nav {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.month-pill {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  min-width: 160px;
  padding: var(--space-8) var(--space-12);
  border: 1px solid transparent;
  border-radius: var(--radius-8);
  background: var(--color-bg-subtle);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  font: inherit;

  &:hover:not(.is-current) {
    border-color: var(--color-border);
  }

  &.is-current {
    cursor: default;
  }
}

.month-name {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
  line-height: 1.2;
}

.month-back {
  font-size: var(--font-size-xs);
  color: var(--color-success);
  margin-top: 2px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-4);
  margin-top: var(--space-12);
}

.dow-cell {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-align: center;
  padding: var(--space-8) 0 var(--space-4);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.cell {
  min-height: 84px;
  gap: var(--space-4);

  --card-selected-color: var(--color-success);

  transition: background 0.15s ease, filter 0.15s ease;

  &.clickable:hover {
    box-shadow: none;
    filter: brightness(0.96);
  }
}

.cell-empty {
  min-height: 84px;
}

.cell-working {
  background: var(--color-success-light);
}

.cell-off {
  background: var(--color-bg-subtle);
}

.cell-absence {
  background: var(--color-warning-light);
}

.cell-past {
  opacity: 0.5;
}

.cell-loading {
  background: var(--color-bg-subtle);
}

.day-num {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  align-self: flex-start;
  line-height: 1;
}

.cell-working .day-num {
  color: var(--color-success);
}

.cell-absence .day-num {
  color: var(--color-warning);
}

.hours {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-success);
  letter-spacing: -0.2px;
}

.hours-off {
  color: var(--color-text-hint);
  font-weight: var(--font-weight-regular);
}

.hours-absence {
  color: var(--color-warning);
}

.dots {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: auto;
  flex-wrap: wrap;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 0 1.5px var(--color-bg-card);
}

.cell-working .dot {
  background: var(--color-success);
}

.dot-more {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-success);
  margin-left: 2px;
}

// Today подсвечивается фоном чуть темнее обычного состояния — цвета и текст
// тех же тонов, чтобы цифры и часы остались читаемы.
.cell-today {
  .day-num {
    font-weight: var(--font-weight-bold);
  }

  &.cell-working {
    background: color-mix(in srgb, var(--color-success) 30%, transparent);
  }

  &.cell-absence {
    background: color-mix(in srgb, var(--color-warning) 30%, transparent);
  }

  &.cell-off {
    background: var(--color-bg-hover);
  }
}

.skeleton-bar {
  height: 10px;
  width: 60%;
  border-radius: var(--radius-4);
  background: var(--color-bg-hover);
  animation: skeleton-pulse 1.2s ease-in-out infinite;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

// ─── Popover ─────────────────────────────────────────────

.popover {
  display: flex;
  flex-direction: column;
}

.popover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: 0 0 var(--space-8);
  text-transform: capitalize;
}

.hours-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  padding: 2px var(--space-8);
  border-radius: var(--radius-full);
  background: var(--color-success-light);
  color: var(--color-success);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.hours-pill-warning {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.hours-pill-muted {
  background: var(--color-bg-subtle);
  color: var(--color-text-secondary);
}

.apts {
  display: flex;
  flex-direction: column;
  padding: var(--space-4) 0 0;
  max-height: 240px;
  overflow-y: auto;
}

.apt {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-4) 0;
  transition: background 0.15s ease;
  border-radius: var(--radius-4);

  &:hover {
    background: var(--color-bg-hover);
  }
}

.apt-time {
  flex-shrink: 0;
  min-width: 46px;
  padding: 1px var(--space-8);
  border-radius: var(--radius-full);
  background: var(--color-success-light);
  color: var(--color-success);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.apt-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.apt-service {
  color: var(--color-text-secondary);
}

.apts-empty {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  padding: var(--space-4) 0;
  color: var(--color-text-hint);
}
</style>
