import { ref, watch, type Ref } from 'vue'
import type {
  Resource, ResourceSlotData, AppointmentStatus, Service,
} from '@fastio/shared'
import {
  resolveResourceWorkingHours,
  utcIsoToLocalDateTime,
  localDateTimeToUtcIso,
  addDaysToDateStr,
  timeToMinutes,
  minutesToTimeStr,
} from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useAppointmentSettingsStore } from '~/stores/appointmentSettings'
import { useDatabase } from '~/composables/data/useDatabase'

export type StaffMonthAppointment = {
  id: string
  startsAt: string
  endsAt: string
  startTimeLocal: string
  customerName: string
  serviceName: string
  status: AppointmentStatus
}

export type StaffMonthDay = {
  date: string
  isWorking: boolean
  openTime: string | null
  closeTime: string | null
  /** Override is_working=false на эту дату — отпуск/отсутствие, а не просто выходной */
  isAbsence: boolean
  appointments: StaffMonthAppointment[]
}

export function useStaffMonthSchedule(
  resource: Ref<Resource | null>,
  monthAnchor: Ref<{ year: number; month: number }>,
) {
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()
  const appointmentSettingsStore = useAppointmentSettingsStore()
  const api = useDatabase()
  const days = ref<Map<string, StaffMonthDay>>(new Map())
  const loading = ref(false)

  const pad = (n: number): string => String(n).padStart(2, '0')

  // Каждое обновление monthAnchor/resource увеличивает gen. Если в момент
  // прихода ответа gen изменился — это устаревший запрос, его игнорим.
  // Защита от гонки при быстром листании месяцев: 8 параллельных запросов
  // успевали накладываться друг на друга и записывать "старый" days.
  let loadGen = 0

  const load = async () => {
    const r = resource.value
    const tenantId = tenantStore.currentTenantId
    const gen = ++loadGen

    if (!r || !tenantId) {
      days.value = new Map()

      return
    }

    loading.value = true
    try {
      const { year, month } = monthAnchor.value
      const fromDate = `${year}-${pad(month + 1)}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      const toDate = `${year}-${pad(month + 1)}-${pad(lastDay)}`
      const tz = tenantStore.tenant.timezone
      const dayStartUtc = localDateTimeToUtcIso(fromDate, '00:00', tz)
      const dayEndUtcExclusive = localDateTimeToUtcIso(addDaysToDateStr(toDate, 1), '00:00', tz)

      const [schedules, disabled, dateOverrides, dateDisabled, shiftTpl, appointmentsRes, services, branchIds] = await Promise.all([
        api.resources.getSchedules(r.id),
        api.resources.getDisabledSlots(r.id),
        api.resources.getDateOverridesRange(r.id, fromDate, toDate),
        api.resources.getDateDisabledSlotsRange(r.id, fromDate, toDate),
        r.appliedTemplateId
          ? api.scheduleTemplates.getFull(r.appliedTemplateId)
          : Promise.resolve(null),
        api.appointments.listPaginated(tenantId, {
          resourceId: r.id,
          dateFrom: dayStartUtc,
          dateTo: dayEndUtcExclusive,
          statuses: ['new', 'confirmed', 'done'],
          page: 1,
          pageSize: 500,
          sortDir: 'asc',
        }),
        api.services.listActive(tenantId),
        api.resources.getBranchIds(r.id),
      ])

      // appointment_settings — глобальные данные тенанта, грузятся в `useTenant.init()`.
      // Здесь читаем из стора (обычно уже прогрето), на случай миса — догружаем.
      if (!appointmentSettingsStore.settings) await appointmentSettingsStore.load()
      const slotStep = appointmentSettingsStore.settings?.slotStepMinutes ?? 30

      const branchSchedule = (() => {
        const branchId = branchIds[0]

        if (branchId) {
          const branch = branchStore.branches.find((b) => b.id === branchId)

          if (branch?.workingHoursSchedule) return branch.workingHoursSchedule
        }

        return tenantStore.tenant.workingHoursSchedule ?? null
      })()

      let shiftCycle: ResourceSlotData['shiftCycle'] = null

      if (r.appliedTemplateId && r.cycleStartDate && shiftTpl?.type === 'shift' && shiftTpl.cycleLength) {
        const slotsByDayIndex: Record<number, string[]> = {}

        for (const s of shiftTpl.slots) {
          const arr = slotsByDayIndex[s.dayIndex] ?? []

          arr.push(s.slotTime)
          slotsByDayIndex[s.dayIndex] = arr
        }
        for (const k of Object.keys(slotsByDayIndex)) slotsByDayIndex[Number(k)].sort()
        shiftCycle = {
          cycleStartDate: r.cycleStartDate,
          cycleLength: shiftTpl.cycleLength,
          slotsByDayIndex,
        }
      }

      const slotData: ResourceSlotData = {
        schedules,
        disabledSlots: disabled,
        dateOverrides,
        dateDisabledSlots: dateDisabled,
        branchSchedule,
        shiftCycle,
      }

      const serviceNameById = new Map<string, string>(services.map((s: Service) => [s.id, s.name]))

      const aptByDate = new Map<string, StaffMonthAppointment[]>()

      for (const a of appointmentsRes.data) {
        const { dateStr, timeStr } = utcIsoToLocalDateTime(a.startsAt, tz)
        const arr = aptByDate.get(dateStr) ?? []

        arr.push({
          id: a.id,
          startsAt: a.startsAt,
          endsAt: a.endsAt,
          startTimeLocal: timeStr,
          customerName: a.customerName,
          serviceName: a.serviceName || (a.serviceId ? (serviceNameById.get(a.serviceId) ?? '—') : '—'),
          status: a.status,
        })
        aptByDate.set(dateStr, arr)
      }

      const result = new Map<string, StaffMonthDay>()

      const shiftSlotsForDate = (date: string): string[] | null => {
        if (!shiftCycle) return null
        const a = Date.UTC(...dateParts(shiftCycle.cycleStartDate))
        const b = Date.UTC(...dateParts(date))
        const offset = Math.floor((b - a) / 86_400_000)
        const len = shiftCycle.cycleLength
        const idx = ((offset % len) + len) % len

        return shiftCycle.slotsByDayIndex[idx] ?? []
      }

      // Для shift-цикла shared-функция возвращает closeTime='23:59' (slot-engine
      // фильтрует по disabled-set), но для отображения нам нужны корректные часы:
      // первый слот → последний слот + slotStep.
      const resolveDisplayHours = (date: string): { openTime: string; closeTime: string } | null => {
        const override = dateOverrides.find((o) => o.date === date)

        if (override) {
          if (!override.isWorking || !override.openTime || !override.closeTime) return null

          return { openTime: override.openTime, closeTime: override.closeTime }
        }
        const cycleSlots = shiftSlotsForDate(date)

        if (cycleSlots !== null) {
          if (cycleSlots.length === 0) return null
          const lastMin = timeToMinutes(cycleSlots[cycleSlots.length - 1]) + slotStep

          return { openTime: cycleSlots[0], closeTime: minutesToTimeStr(lastMin) }
        }

        return resolveResourceWorkingHours(date, slotData)
      }

      for (let d = 1; d <= lastDay; d++) {
        const date = `${year}-${pad(month + 1)}-${pad(d)}`
        const hours = resolveDisplayHours(date)
        const override = dateOverrides.find((o) => o.date === date)
        const isAbsence = !!override && !override.isWorking

        result.set(date, {
          date,
          isWorking: !!hours,
          openTime: hours?.openTime ?? null,
          closeTime: hours?.closeTime ?? null,
          isAbsence,
          appointments: aptByDate.get(date) ?? [],
        })
      }

      // Если за время загрузки уже стартанул новый запрос — наши данные устарели.
      if (gen !== loadGen) return

      days.value = result
    } finally {
      // loading сбрасываем только если это всё ещё наш актуальный запрос —
      // иначе свежий запрос увидит loading=false и моргнёт.
      if (gen === loadGen) loading.value = false
    }
  }

  watch([resource, monthAnchor], load, { immediate: true, deep: true })

  return { loading, days, reload: load }
}

const dateParts = (s: string): [number, number, number] => {
  const [y, m, d] = s.split('-').map(Number)

  return [y, m - 1, d]
}
