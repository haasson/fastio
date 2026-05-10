<template>
  <div ref="rootRef" class="timeline-root" :style="{ height: timelineHeight }">
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
    </div>

    <UiSkeleton v-if="initialLoading" :repeat="3" />

    <UiEmpty
      v-else-if="!visibleResources.length"
      icon="users"
      text="Нет исполнителей"
      description="Добавьте исполнителей в разделе «Исполнители»"
    />

    <AppointmentTimelineGrid
      v-else
      ref="gridRef"
      :resources="visibleResources"
      :appointments="appointments"
      :availability="availability"
      :window-open="viewWindow.open"
      :window-close="viewWindow.close"
      :slot-step="settings?.slotStepMinutes ?? 30"
      :tz="tz"
      :resource-label="settings?.resourceLabel"
      :editable="canManage"
      :now="nowProp"
      :date-is-today="showNow"
      :hide-phones="ownResourcesOnly"
      :category-color-map="categoryColorMap"
      :get-move-blocker="getMoveBlocker"
      @appt-click="onApptClick"
      @cell-click="onCellClick"
      @appt-move="onApptMove"
    />

    <MoveAppointmentConfirmModal
      v-model="moveModalOpen"
      :pending="movePending"
      :resources="resources"
      :tz="tz"
      :loading="moveSaving"
      :on-confirm="confirmMovePending"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from '#imports'
import { UiButton, UiDatepicker, UiSkeleton, UiEmpty, useMessage } from '@fastio/ui'
import type { Appointment } from '@fastio/shared'
import {
  todayInTz, getBranchWidestWindow, getBranchHoursForDow,
  addDaysToDateStr, localDateTimeToUtcIso, getCategoryColorHex,
} from '@fastio/shared'
import type { WorkingHoursSchedule } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useAppointmentSettingsStore } from '~/features/appointments/stores/appointmentSettings'
import { useDatabase } from '~/composables/data/useDatabase'
import { useGate } from '~/composables/plan/useGate'
import { useAppointmentViewScope } from '~/features/appointments/composables/useAppointmentViewScope'
import { appointmentBus } from '~/features/appointments/composables/useAppointmentsChannel'
import { reportError } from '~/utils/reportError'
import { buildTimelineAvailability, type TimelineAvailability } from '~/features/appointments/utils/timelineAvailability'
import { useTimelineMoveBlocker } from '~/features/appointments/composables/useTimelineMoveBlocker'
import { useEditorCompetencies } from '~/features/appointments/composables/useEditorCompetencies'
import AppointmentTimelineGrid from '~/components/appointments/AppointmentTimelineGrid.vue'
import MoveAppointmentConfirmModal, { type MovePending } from '~/components/appointments/MoveAppointmentConfirmModal.vue'

const router = useRouter()

const message = useMessage()

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const appointmentSettingsStore = useAppointmentSettingsStore()
const gate = useGate()
const competenciesHelper = useEditorCompetencies()
const { competencyByResource } = competenciesHelper
const { ownResourcesOnly, isOwnResource } = useAppointmentViewScope()
const { currentTenantId } = storeToRefs(tenantStore)
const { settings } = storeToRefs(appointmentSettingsStore)
const api = useDatabase()

const tz = computed(() => tenantStore.tenant.timezone ?? 'Europe/Moscow')
const todayStr = computed(() => todayInTz(tz.value))
const canManage = computed(() => gate.manageAppointments.value.enabled)

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

// ─── Visible resources ────────────────────────────────────

const visibleResources = computed(() => {
  if (!ownResourcesOnly.value) return resources.value

  return resources.value.filter(isOwnResource)
})

// ─── Data ──────────────────────────────────────────────────

const resources = ref<import('@fastio/shared').Resource[]>([])
const appointments = ref<Appointment[]>([])
const availability = ref<TimelineAvailability>({})
// serviceId → hex цвета категории
const categoryColorMap = ref<Map<string, string>>(new Map())

const loading = ref(false)
// Скелетон показываем ТОЛЬКО до первого успешного fetch'а. Дальше realtime/смена
// даты обновляют данные «в фоне», грид не размонтируется — иначе при каждом
// drop scrollTop сбрасывается на 0.
const initialLoading = ref(true)

// Generation-counter против гонок: при быстром переключении даты/филиала или
// одновременных realtime-эвентах несколько fetch'ей могут лететь параллельно.
// Применяем в state только результат последнего инициированного запроса.
let fetchGen = 0

// Каталог услуг и категорий стабилен в рамках сессии — грузим один раз.
let servicesCache: Awaited<ReturnType<typeof api.services.list>> | null = null
let categoriesCache: Awaited<ReturnType<typeof api.categories.list>> | null = null

const reload = async (opts: { scrollOnLoad?: boolean } = {}) => {
  if (!currentTenantId.value) return
  const gen = ++fetchGen

  loading.value = true
  try {
    if (!appointmentSettingsStore.settings) await appointmentSettingsStore.load()

    // resources грузим первым: при view_own нужно знать собственные ресурсы,
    // чтобы передать их в listForDay серверным фильтром (#1: ужесточаем
    // клиентский view_own — не тащим телефоны чужих клиентов на фронт).
    const res = await api.resources.list(currentTenantId.value)

    if (gen !== fetchGen) return

    let activeResources = res.filter((r) => r.isActive)

    if (branchStore.currentBranchId) {
      const branchIds = await api.resources.listBranchIds(activeResources.map((r) => r.id))

      activeResources = activeResources.filter((r) => {
        const ids = branchIds.get(r.id) ?? []

        return ids.length === 0 || ids.includes(branchStore.currentBranchId!)
      })
    }
    const ownResourceIds = ownResourcesOnly.value
      ? activeResources.filter(isOwnResource).map((r) => r.id)
      : undefined

    const [appts, services, categories] = await Promise.all([
      api.appointments.listForDay(currentTenantId.value, selectedDate.value, {
        branchId: branchStore.currentBranchId ?? undefined,
        resourceIds: ownResourceIds,
        timezone: tz.value,
      }),
      servicesCache ?? api.services.list(currentTenantId.value),
      categoriesCache ?? api.categories.list(currentTenantId.value, 'service'),
    ])

    if (gen !== fetchGen) return

    servicesCache = services
    categoriesCache = categories

    const newColorMap = new Map<string, string>()
    const categoryById = new Map(categories.map((c) => [c.id, c]))

    for (const svc of services) {
      const hex = svc.categoryId
        ? getCategoryColorHex(categoryById.get(svc.categoryId)?.color ?? null)
        : null

      if (hex) newColorMap.set(svc.id, hex)
    }
    categoryColorMap.value = newColorMap
    resources.value = activeResources
    appointments.value = appts

    // Компетенции — для проверки при DnD «новый мастер умеет эту услугу».
    await competenciesHelper.load(activeResources, services).catch(reportError)

    if (gen !== fetchGen) return

    if (activeResources.length === 0) {
      availability.value = {}
    } else {
      const dayStartUtc = localDateTimeToUtcIso(selectedDate.value, '00:00', tz.value)
      const dayEndUtc = localDateTimeToUtcIso(addDaysToDateStr(selectedDate.value, 1), '00:00', tz.value)
      const shiftTemplateIds = Array.from(new Set(
        activeResources
          .filter((r) => r.appliedTemplateId && r.cycleStartDate)
          .map((r) => r.appliedTemplateId as string),
      ))

      const bundle = await api.resources.bulkLoadAvailability({
        tenantId: currentTenantId.value,
        resourceIds: activeResources.map((r) => r.id),
        date: selectedDate.value,
        dayStartUtc,
        dayEndUtc,
        shiftTemplateIds,
      })

      if (gen !== fetchGen) return

      availability.value = buildTimelineAvailability({
        resources: activeResources,
        date: selectedDate.value,
        bundle,
        branches: branchStore.branches,
        tenantSchedule: tenantStore.maybeTenant?.workingHoursSchedule ?? null,
      })
    }
  } catch (e) {
    if (gen !== fetchGen) return
    reportError(e)
    message.error('Не удалось загрузить расписание')
  } finally {
    if (gen === fetchGen) {
      loading.value = false
      initialLoading.value = false
    }
  }

  // Скролл — только если этот fetch ещё актуален, и ПОСЛЕ снятия initialLoading,
  // иначе грид ещё не смонтирован (v-if="initialLoading"), gridRef=null →
  // scrollToNow никогда не сработает.
  if (gen === fetchGen && opts.scrollOnLoad !== false) {
    await nextTick()
    gridRef.value?.scrollToNow()
  }
}

reload({ scrollOnLoad: true })

watch([selectedDate, () => branchStore.currentBranchId], () => reload({ scrollOnLoad: true }))

// ─── Time window ──────────────────────────────────────────

const referenceSchedule = computed<WorkingHoursSchedule | null>(() => {
  if (branchStore.currentBranchId) {
    const b = branchStore.branches.find((x) => x.id === branchStore.currentBranchId)

    if (b?.workingHoursSchedule) return b.workingHoursSchedule
  }

  return tenantStore.maybeTenant?.workingHoursSchedule ?? null
})

const viewWindow = computed(() => {
  const sched = referenceSchedule.value

  if (sched) {
    const dow = new Date(`${selectedDate.value}T12:00:00`).getDay()
    const day = getBranchHoursForDow(sched, dow)
    const win = day ?? getBranchWidestWindow(sched)

    if (win) return { open: win.open, close: win.close }
  }

  return { open: '08:00', close: '22:00' }
})

// ─── Now line + auto-scroll ───────────────────────────────

const rootRef = ref<HTMLElement | null>(null)
const gridRef = ref<InstanceType<typeof AppointmentTimelineGrid> | null>(null)
const now = ref(Date.now())

const timelineHeight = shallowRef<string>('360px')

const updateHeight = () => {
  const el = rootRef.value

  if (!el) return

  const top = el.getBoundingClientRect().top
  const paddingBottom = parseInt(getComputedStyle(el).getPropertyValue('--content-padding'), 10) || 0
  const h = Math.max(360, window.innerHeight - top - paddingBottom)

  timelineHeight.value = `${h}px`
}

onMounted(() => {
  nextTick(updateHeight)
  window.addEventListener('resize', updateHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateHeight)
})
const showNow = computed(() => selectedDate.value === todayStr.value)
const nowProp = computed(() => showNow.value ? now.value : null)

const nowTimer = setInterval(() => {
  now.value = Date.now()
}, 60_000)

// ─── Navigation ───────────────────────────────────────────

const onApptClick = (appt: Appointment) => {
  // Мастер с view_own видит только свою услугу — открываем компактный
  // appointment-view, без чужих услуг визита и без телефона клиента.
  if (ownResourcesOnly.value) {
    router.push({
      path: `/appointments/appointment/${appt.id}`,
      query: { from: 'timeline' },
    })

    return
  }

  // groupId с миграции 218 NOT NULL; на старых записях защитный фолбек на id.
  router.push({
    path: `/appointments/visits/${appt.groupId ?? appt.id}`,
    query: { from: 'timeline' },
  })
}

const onCellClick = ({ resourceId, time }: { resourceId: string; time: string }) => {
  const branchQuery = branchStore.currentBranchId ? { branchId: branchStore.currentBranchId } : {}

  router.push({
    path: '/appointments/visits/new',
    query: {
      date: selectedDate.value,
      slotTime: time,
      resourceId,
      from: 'timeline',
      ...branchQuery,
    },
  })
}

// ─── Drag & resize ────────────────────────────────────────
//
// Optimistic update: сразу двигаем в локальном списке. На ошибке (RPC fail или
// конфликт capacity) — откатываем. Валидация drop'а — в useTimelineMoveBlocker.

const { getMoveBlocker } = useTimelineMoveBlocker({
  availability,
  resources,
  appointments,
  settings,
  selectedDate,
  todayStr,
  now,
  tz,
  competencyByResource,
})

// Pending-перенос: drop НЕ применяет изменения сразу, а готовит payload и
// открывает модалку. Сохранение — только по «Подтвердить».
const movePending = ref<MovePending | null>(null)
const moveModalOpen = ref(false)
const moveSaving = ref(false)

const onApptMove = ({ appt, dyMin, newResourceId }: { appt: Appointment; dyMin: number; newResourceId: string }) => {
  const blocker = getMoveBlocker({ appt, dyMin, newResourceId })

  if (blocker) {
    message.error(blocker)

    return
  }

  const offsetMs = dyMin * 60 * 1000
  const newStartIso = new Date(new Date(appt.startsAt).getTime() + offsetMs).toISOString()
  const newEndIso = new Date(new Date(appt.endsAt).getTime() + offsetMs).toISOString()
  const newActualEndIso = appt.actualEndsAt
    ? new Date(new Date(appt.actualEndsAt).getTime() + offsetMs).toISOString()
    : null

  movePending.value = {
    appt,
    newResourceId,
    newStartIso,
    newEndIso,
    newActualEndIso,
  }
  moveSaving.value = false
  moveModalOpen.value = true
}

const confirmMovePending = async (): Promise<boolean | void> => {
  const pending = movePending.value

  if (!pending) return false

  const apptId = pending.appt.id
  const idx = appointments.value.findIndex((a) => a.id === apptId)

  if (idx === -1) {
    movePending.value = null

    return true
  }

  const original = appointments.value[idx]

  moveSaving.value = true

  // Optimistic в локальном списке: откатим если RPC упадёт.
  appointments.value[idx] = {
    ...original,
    resourceId: pending.newResourceId,
    startsAt: pending.newStartIso,
    endsAt: pending.newEndIso,
    actualEndsAt: pending.newActualEndIso,
  }

  try {
    // RPC `update_appointment` (capacity-чек + advisory_xact_lock + audit-events).
    // Прямой UPDATE по таблице обходит эту защиту — между нашим клиентским
    // hasConflict и UPDATE другой админ может INSERT'нуть в тот же слот.
    await api.appointments.reschedule(apptId, {
      resourceId: pending.newResourceId,
      startsAt: pending.newStartIso,
      endsAt: pending.newEndIso,
    })
    // RPC не трогает actual_ends_at (см. 220_appointment_diff_rpcs.sql:12).
    // Для записей с extended-end (variable-mode mark_done или extend_appointment)
    // двигаем actual_ends_at прямым UPDATE — это не влияет на capacity-чек
    // главного слота (он уже прошёл выше) и не нуждается в advisory lock.
    if (pending.newActualEndIso !== null && original.actualEndsAt !== null) {
      await api.appointments.update(apptId, { actualEndsAt: pending.newActualEndIso })
    }
    movePending.value = null
    moveSaving.value = false
  } catch (e) {
    // Между optimistic-апдейтом и await realtime-fetch (200мс debounce) мог
    // перетряхнуть список — ищем запись по id, а не по сохранённому idx.
    const rollbackIdx = appointments.value.findIndex((a) => a.id === apptId)

    if (rollbackIdx !== -1) appointments.value[rollbackIdx] = original
    reportError(e)
    message.error('Не удалось переместить запись')
    moveSaving.value = false

    return false
  }
}

// Realtime: дебаунсим bulk-bookings (5 INSERT-эвентов в одной группе) в один fetch.
// scrollOnLoad=false — иначе после своего же optimistic-drop таймлайн уезжает к now.
let fetchTimer: ReturnType<typeof setTimeout> | null = null
const scheduleFetch = () => {
  if (fetchTimer) clearTimeout(fetchTimer)
  fetchTimer = setTimeout(() => {
    fetchTimer = null
    reload({ scrollOnLoad: false })
  }, 200)
}

// Realtime: фильтр по текущему филиалу — иначе INSERT/UPDATE из соседнего
// филиала дёргают timeline на пустой апдейт каждые 200мс. Если глобальный
// фильтр сайдбара = null («все филиалы»), пропускаем все события.
const isPayloadInCurrentBranch = (a: { branchId?: string | null }): boolean => {
  const cur = branchStore.currentBranchId

  if (!cur) return true

  // Записи без branch_id (legacy) показываются в любом филиале — иначе sidebar
  // на «Брянск» их потеряет вообще, и orphan-сирота навсегда исчезнет из UI.
  return !a.branchId || a.branchId === cur
}

const offInsert = appointmentBus.onInsert((a) => {
  if (isPayloadInCurrentBranch(a)) scheduleFetch()
})
const offUpdate = appointmentBus.onUpdate((a) => {
  if (isPayloadInCurrentBranch(a)) scheduleFetch()
})
// DELETE-payload содержит только { id } (postgres-realtime обычно не отдаёт OLD-record), —
// фильтр по branch_id невозможен. Всегда рефетчим, даже если запись была в чужом
// филиале: лишний один query за 200мс — ничего страшного, корректность важнее.
const offDelete = appointmentBus.onDelete(() => scheduleFetch())

onUnmounted(() => {
  if (fetchTimer) clearTimeout(fetchTimer)
  clearInterval(nowTimer)
  offInsert()
  offUpdate()
  offDelete()
})
</script>

<style scoped lang="scss">
.timeline-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
  // height задаётся через :style — window.innerHeight минус реальный top элемента
  min-height: 360px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.date-picker {
  width: 160px;
}

</style>
