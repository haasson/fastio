<template>
  <div class="timeline-root">
    <div class="toolbar">
      <UiButton
        type="text"
        icon="chevronLeft"
        size="small"
        @click="prevDay"
      />
      <UiDatepicker v-model="selectedTs" size="small" class="date-picker" />
      <UiButton
        type="text"
        icon="chevronRight"
        size="small"
        @click="nextDay"
      />
      <UiButton type="text" size="small" @click="goToday">Сегодня</UiButton>

      <UiSelect
        v-if="branchStore.branches.length > 1"
        v-model:value="selectedBranchId"
        :options="branchOptions"
        size="small"
        placeholder="Все филиалы"
        clearable
        class="branch-select"
      />
    </div>

    <UiSkeleton v-if="loading" :repeat="3" />

    <UiEmpty
      v-else-if="!resources.length"
      icon="users"
      text="Нет исполнителей"
      description="Добавьте исполнителей в разделе «Исполнители»"
    />

    <div v-else class="timeline-wrap">
      <div class="timeline-table">
        <!-- Header -->
        <div class="timeline-header">
          <div class="time-col-header" />
          <div
            v-for="resource in resources"
            :key="resource.id"
            class="resource-col-header"
          >
            <UiText weight="medium">{{ resource.name }}</UiText>
            <UiText size="small" class="resource-type">{{ resource.type === 'person' ? (settings?.resourceLabel || 'Специалист') : 'Объект' }}</UiText>
          </div>
        </div>

        <!-- Time rows -->
        <div class="timeline-body">
          <div
            v-for="slot in timeSlots"
            :key="slot"
            class="timeline-row"
          >
            <div class="time-col">
              <UiText size="small" class="time-label">{{ slot }}</UiText>
            </div>
            <div
              v-for="resource in resources"
              :key="resource.id"
              class="slot-cell"
              :class="cellClasses(resource.id, slot)"
              @click="handleCellClick(resource.id, slot)"
            >
              <template v-if="getAppointment(resource.id, slot) && isApptStart(getAppointment(resource.id, slot)!, slot)">
                <div
                  class="appt-block"
                  :class="[
                    `status-${getAppointment(resource.id, slot)!.status}`,
                    ...apptBlockModifiers(getAppointment(resource.id, slot)!, slot),
                  ]"
                >
                  <UiText size="tiny" weight="medium">{{ getAppointment(resource.id, slot)!.customerName }}</UiText>
                  <UiText size="tiny" class="appt-dish">{{ getAppointment(resource.id, slot)!.serviceName }}</UiText>
                </div>
              </template>
              <template v-else-if="getAppointment(resource.id, slot)">
                <div
                  class="appt-block"
                  :class="[
                    `status-${getAppointment(resource.id, slot)!.status}`,
                    ...apptBlockModifiers(getAppointment(resource.id, slot)!, slot),
                  ]"
                />
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from '#imports'
import { UiButton, UiDatepicker, UiSelect, UiSkeleton, UiEmpty, UiText, useMessage } from '@fastio/ui'
import type { Appointment } from '@fastio/shared'
import { todayInTz, getAllSlotsInWindow, timeToMinutes, getBranchWidestWindow, getBranchHoursForDow } from '@fastio/shared'
import type { WorkingHoursSchedule } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useAppointmentSettingsStore } from '~/stores/appointmentSettings'
import { useDatabase } from '~/composables/data/useDatabase'
import { appointmentBus } from '~/composables/data/useAppointmentsChannel'
import { reportError } from '~/utils/reportError'

const router = useRouter()

const message = useMessage()

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const appointmentSettingsStore = useAppointmentSettingsStore()
const { currentTenantId } = storeToRefs(tenantStore)
const { settings } = storeToRefs(appointmentSettingsStore)
const api = useDatabase()

const tz = computed(() => tenantStore.tenant.timezone ?? 'Europe/Moscow')
const todayStr = computed(() => todayInTz(tz.value))

// ─── Date navigation ─────────────────────────────────────

const selectedTs = ref<number | null>(Date.now())
const selectedDate = computed(() => {
  if (!selectedTs.value) return todayStr.value
  const d = new Date(selectedTs.value)

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const prevDay = () => {
  const d = new Date(selectedTs.value ?? Date.now())

  d.setDate(d.getDate() - 1)
  selectedTs.value = d.getTime()
}

const nextDay = () => {
  const d = new Date(selectedTs.value ?? Date.now())

  d.setDate(d.getDate() + 1)
  selectedTs.value = d.getTime()
}

const goToday = () => {
  selectedTs.value = Date.now()
}

// ─── Branch filter ────────────────────────────────────────

const selectedBranchId = ref<string | null>(null)

const branchOptions = computed(() => [
  { label: 'Все филиалы', value: null },
  ...branchStore.branches.map((b) => ({ label: b.name, value: b.id })),
])

// ─── Data ──────────────────────────────────────────────────

const resources = ref<import('@fastio/shared').Resource[]>([])
const appointments = ref<Appointment[]>([])

const loading = ref(false)

const fetch = async () => {
  if (!currentTenantId.value) return
  loading.value = true
  try {
    // appointment_settings — глобальные данные, грузятся в `useTenant.init()`
    // и слушаются через store. На случай миса при первом рендере — догружаем.
    if (!appointmentSettingsStore.settings) await appointmentSettingsStore.load()

    const [res, appts] = await Promise.all([
      api.resources.list(currentTenantId.value),
      api.appointments.listForDay(currentTenantId.value, selectedDate.value, {
        branchId: selectedBranchId.value ?? undefined,
        timezone: tz.value,
      }),
    ])

    resources.value = res.filter((r) => r.isActive)
    appointments.value = appts
  } catch (e) {
    reportError(e)
    message.error('Не удалось загрузить расписание')
  } finally {
    loading.value = false
  }
}

fetch()

// При смене выбранной даты или филиала — перезагружаем записи.
watch([selectedDate, selectedBranchId], () => fetch())

// ─── Time slots ───────────────────────────────────────────

// Сетка времени берётся из графика филиала (если выбран один) или
// самого широкого окна по всем филиалам тенанта; с фолбеком на график тенанта.
const referenceSchedule = computed<WorkingHoursSchedule | null>(() => {
  if (selectedBranchId.value) {
    const b = branchStore.branches.find((x) => x.id === selectedBranchId.value)

    if (b?.workingHoursSchedule) return b.workingHoursSchedule
  }

  return tenantStore.maybeTenant?.workingHoursSchedule ?? null
})

const timeSlots = computed(() => {
  const step = settings.value?.slotStepMinutes ?? 30
  const sched = referenceSchedule.value

  // Если выбрана конкретная дата — берём окно её дня недели; иначе самое широкое.
  if (sched) {
    const dow = new Date(selectedDate.value + 'T12:00:00').getDay()
    const day = getBranchHoursForDow(sched, dow)
    const win = day ?? getBranchWidestWindow(sched)

    if (win) return getAllSlotsInWindow(win.open, win.close, step)
  }

  return getAllSlotsInWindow('08:00', '22:00', step)
})

// ─── Cell lookup ──────────────────────────────────────────

// UTC ISO → минуты дня в tz тенанта.
const toLocalMinutes = (iso: string): number => {
  const t = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz.value,
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
  const [h, m] = t.split(':').map(Number)

  return h * 60 + m
}

// Запись, чьё окно [start, end) накрывает слот. Учитываем actualEndsAt
// при variable-режиме (по той же логике, что и в slot engine).
const getAppointment = (resourceId: string, slotTime: string): Appointment | null => appointments.value.find((a) => {
  if (a.resourceId !== resourceId) return false
  const slotMin = timeToMinutes(slotTime)
  const startMin = toLocalMinutes(a.startsAt)
  const endIso = a.actualEndsAt ?? a.endsAt
  const endMin = toLocalMinutes(endIso)

  return slotMin >= startMin && slotMin < endMin
}) ?? null

const isApptStart = (a: Appointment, slotTime: string): boolean => toLocalMinutes(a.startsAt) === timeToMinutes(slotTime)

// Позиция слота относительно записи: для CSS-склейки ячеек в один блок.
type CellPosition = 'single' | 'start' | 'middle' | 'end'

const apptCellPosition = (a: Appointment, slotTime: string): CellPosition => {
  const step = settings.value?.slotStepMinutes ?? 30
  const startMin = toLocalMinutes(a.startsAt)
  const endMin = toLocalMinutes(a.actualEndsAt ?? a.endsAt)
  const slotMin = timeToMinutes(slotTime)
  const isStart = slotMin === startMin
  const isLast = slotMin + step >= endMin

  if (isStart && isLast) return 'single'
  if (isStart) return 'start'
  if (isLast) return 'end'

  return 'middle'
}

// Маппинг логической позиции в реально определённые CSS-классы.
// `single` — одиночный слот, без модификатора склейки.
// `start` — первый слот multi-записи (контент), нижние углы прямые.
// `middle` / `end` — продолжение, без верхнего отступа и со срезанными верхними углами.
const cellClasses = (resourceId: string, slotTime: string): string[] => {
  const appt = getAppointment(resourceId, slotTime)

  if (!appt) return []

  const pos = apptCellPosition(appt, slotTime)
  const classes = ['slot-cell--occupied']

  if (pos === 'middle' || pos === 'end') classes.push('slot-cell--continuation')

  return classes
}

const apptBlockModifiers = (a: Appointment, slotTime: string): string[] => {
  const pos = apptCellPosition(a, slotTime)

  if (pos === 'single') return []
  if (pos === 'start') return ['appt-block--multi']

  return ['appt-block--continuation']
}

// ─── Navigation ───────────────────────────────────────────
//
// Клик по занятой ячейке → страница визита (group_id у appointment теперь NOT NULL).
// Клик по пустой → /appointments/visits/new с префиллом даты/филиала/исполнителя.
// Дровер выпилен — единая страница для создания и редактирования.

const handleCellClick = (resourceId: string, slot: string) => {
  const appt = getAppointment(resourceId, slot)

  if (appt) {
    router.push(`/appointments/visits/${appt.groupId}`)

    return
  }

  const branchQuery = selectedBranchId.value ? { branchId: selectedBranchId.value } : {}

  router.push({
    path: '/appointments/visits/new',
    query: {
      date: selectedDate.value,
      slotTime: slot,
      resourceId,
      ...branchQuery,
    },
  })
}

// Realtime: подхватываем новые/обновлённые/удалённые записи.
// Bulk-bookings (5 услуг = 5 INSERT-эвентов в течение ~100мс) запускали
// 5 параллельных fetch'ей. Дебаунсим 200мс — все эвенты складываются в один
// перезапрос.
let fetchTimer: ReturnType<typeof setTimeout> | null = null
const scheduleFetch = () => {
  if (fetchTimer) clearTimeout(fetchTimer)
  fetchTimer = setTimeout(() => {
    fetchTimer = null
    fetch()
  }, 200)
}

const offInsert = appointmentBus.onInsert(scheduleFetch)
const offUpdate = appointmentBus.onUpdate(scheduleFetch)
const offDelete = appointmentBus.onDelete(scheduleFetch)

onUnmounted(() => {
  if (fetchTimer) clearTimeout(fetchTimer)
  offInsert()
  offUpdate()
  offDelete()
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as mq;

.timeline-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.date-picker {
  width: 160px;
}

.branch-select {
  width: 180px;
  margin-left: auto;
}

.timeline-wrap {
  overflow-x: auto;
}

.timeline-table {
  min-width: 600px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-8);
  overflow: hidden;
}

.timeline-header {
  display: flex;
  background: var(--color-bg-hover);
  border-bottom: 1px solid var(--color-border);
}

.time-col-header {
  width: 64px;
  flex-shrink: 0;
}

.resource-col-header {
  flex: 1;
  padding: var(--space-8) var(--space-12);
  border-left: 1px solid var(--color-border);
  min-width: 140px;
}

.resource-type {
  color: var(--color-text-hint);
}

.timeline-body {
  display: flex;
  flex-direction: column;
}

.timeline-row {
  display: flex;
  min-height: 48px;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
}

.time-col {
  width: 64px;
  flex-shrink: 0;
  padding: var(--space-4) var(--space-8);
  display: flex;
  align-items: flex-start;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-hover);
}

.time-label {
  color: var(--color-text-secondary);
  line-height: 1;
  margin-top: var(--space-4);
}

.slot-cell {
  flex: 1;
  border-left: 1px solid var(--color-border);
  padding: var(--space-4);
  min-width: 140px;
  cursor: pointer;
  transition: background 0.1s;

  &:hover {
    background: var(--color-bg-hover);
  }

  &--occupied {
    cursor: pointer;
  }

  // Продолжение записи — без верхнего отступа, чтобы блок "слипался" со стартовым.
  &--continuation {
    padding-top: 0;
  }
}

.appt-block {
  border-radius: var(--radius-8);
  padding: var(--space-4) var(--space-8);
  height: 100%;
  min-height: 40px;

  // У записи на >1 слот — нижний радиус сглаживается с continuation.
  &--multi {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    margin-bottom: -1px;
  }

  &--continuation {
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    margin-top: -1px; // съесть зазор между ячейками
    padding: 0;
  }

  &.status-new {
    background: var(--yellow-100);
    border-left: 3px solid var(--yellow-500);
  }

  &.status-confirmed {
    background: var(--green-100);
    border-left: 3px solid var(--green-500);
  }

  &.status-done {
    background: var(--grey-100);
    border-left: 3px solid var(--grey-400);
  }

  &.status-cancelled {
    background: var(--red-50);
    border-left: 3px solid var(--red-300);
    opacity: 0.6;
  }
}

.appt-dish {
  color: var(--color-text-secondary);
}
</style>
