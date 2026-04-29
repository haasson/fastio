import { ref } from 'vue'
import type {
  Service, Resource, ResourceSlotData, AppointmentInterval, WorkingHoursSchedule,
} from '@fastio/shared'
import {
  getResourceSlotsForDate, getEffectiveServiceIds, addDaysToDateStr, localDateTimeToUtcIso,
} from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useDatabase } from '~/composables/data/useDatabase'

const sliceTime = (v: unknown): string | null => typeof v === 'string' ? v.slice(0, 5) : null

export type ResourceCheckResult = {
  competent: boolean
  working: boolean
  free: boolean
  conflictId: string | null
  reason: 'ok' | 'not-competent' | 'day-off' | 'busy'
}

/**
 * Загружает данные доступности (расписания, занятость, компетенции)
 * для всех ресурсов на конкретную дату — для умного выбора исполнителя
 * и валидации времени в AppointmentDrawer.
 */
export function useAppointmentAvailability() {
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()
  const api = useDatabase()

  const loading = ref(false)
  const ready = ref(false)
  const currentDate = ref<string | null>(null)

  const competencyByResource = new Map<string, Set<string>>()
  const slotDataByResource = new Map<string, ResourceSlotData>()
  const appointmentsByResource = new Map<string, Array<{ id: string; startsAt: string; endsAt: string }>>()

  const reset = () => {
    competencyByResource.clear()
    slotDataByResource.clear()
    appointmentsByResource.clear()
    currentDate.value = null
    ready.value = false
  }

  const loadForDate = async (date: string, services: Service[], resources: Resource[]): Promise<void> => {
    if (currentDate.value === date && ready.value) return
    if (!tenantStore.currentTenantId) {
      reset()

      return
    }

    reset()
    currentDate.value = date
    loading.value = true

    try {
      const tenantId = tenantStore.currentTenantId
      const tz = tenantStore.tenant.timezone
      const resourceIds = resources.map((r) => r.id)

      if (resourceIds.length === 0) {
        ready.value = true

        return
      }

      const dayStartUtc = localDateTimeToUtcIso(date, '00:00', tz)
      const dayEndUtc = localDateTimeToUtcIso(addDaysToDateStr(date, 1), '00:00', tz)

      // Ресурсы с привязкой к shift-шаблону: грузим сами шаблоны и их слоты,
      // чтобы lazy-вычисление цикла работало без материализации в БД.
      const shiftResources = resources.filter((r) => r.appliedTemplateId && r.cycleStartDate)
      const shiftTemplateIds = Array.from(new Set(shiftResources.map((r) => r.appliedTemplateId as string)))

      const bundle = await api.resources.bulkLoadAvailability({
        tenantId, resourceIds, date, dayStartUtc, dayEndUtc, shiftTemplateIds,
      })

      // ─── Shift-цикл: собираем slotsByDayIndex для каждого шаблона ─
      const shiftSlotsByTemplate = new Map<string, Record<number, string[]>>()

      for (const row of bundle.shiftTemplateSlots) {
        const map = shiftSlotsByTemplate.get(row.template_id) ?? {}
        const idx = row.day_index
        const arr = map[idx] ?? []

        arr.push(row.slot_time.slice(0, 5))
        map[idx] = arr
        shiftSlotsByTemplate.set(row.template_id, map)
      }

      const shiftTemplateMeta = new Map<string, number>(
        bundle.shiftTemplates.map((t) => [t.id, t.cycle_length as number]),
      )

      // Сортируем слоты в каждом дне.
      for (const [, byDay] of shiftSlotsByTemplate) {
        for (const k of Object.keys(byDay)) byDay[Number(k)].sort()
      }

      // ─── Компетенции ──────────────────────────────────────
      // Объединяем явные (service_resources) и через категории (resource_categories)
      // через шарный helper getEffectiveServiceIds.
      const explicitByResource = new Map<string, string[]>()

      for (const row of bundle.serviceResources) {
        const arr = explicitByResource.get(row.resource_id) ?? []

        arr.push(row.service_id)
        explicitByResource.set(row.resource_id, arr)
      }

      const categoryIdsByResource = new Map<string, string[]>()

      for (const row of bundle.resourceCategories) {
        const arr = categoryIdsByResource.get(row.resource_id) ?? []

        arr.push(row.category_id)
        categoryIdsByResource.set(row.resource_id, arr)
      }

      const servicesForCompute = services.map((s) => ({ id: s.id, categoryId: s.categoryId }))

      for (const rid of resourceIds) {
        const ids = getEffectiveServiceIds(
          explicitByResource.get(rid) ?? [],
          categoryIdsByResource.get(rid) ?? [],
          servicesForCompute,
        )

        competencyByResource.set(rid, new Set(ids))
      }

      // ─── Branch fallback schedule ─────────────────────────
      const branchByResource = new Map<string, string>()

      for (const row of bundle.branchLinks) {
        if (!branchByResource.has(row.resource_id)) branchByResource.set(row.resource_id, row.branch_id)
      }

      const branchScheduleById = new Map<string, WorkingHoursSchedule | null>()

      for (const b of branchStore.branches) {
        branchScheduleById.set(b.id, b.workingHoursSchedule ?? null)
      }
      const tenantSchedule = tenantStore.tenant.workingHoursSchedule ?? null

      // ─── ResourceSlotData для каждого ресурса ────────────
      for (const rid of resourceIds) {
        const data: ResourceSlotData = {
          schedules: bundle.schedules
            .filter((s) => s.resource_id === rid)
            .map((s) => ({
              id: s.id,
              resourceId: s.resource_id,
              dayOfWeek: s.day_of_week,
              isWorking: s.is_working,
              openTime: sliceTime(s.open_time),
              closeTime: sliceTime(s.close_time),
            })),
          disabledSlots: bundle.disabledSlots
            .filter((s) => s.resource_id === rid)
            .map((s) => ({
              id: s.id,
              resourceId: s.resource_id,
              dayOfWeek: s.day_of_week,
              slotTime: s.slot_time.slice(0, 5),
            })),
          dateOverrides: bundle.dateOverrides
            .filter((s) => s.resource_id === rid)
            .map((s) => ({
              id: s.id,
              resourceId: s.resource_id,
              date: s.date,
              isWorking: s.is_working,
              openTime: sliceTime(s.open_time),
              closeTime: sliceTime(s.close_time),
            })),
          dateDisabledSlots: bundle.dateDisabledSlots
            .filter((s) => s.resource_id === rid)
            .map((s) => ({
              id: s.id,
              resourceId: s.resource_id,
              date: s.date,
              slotTime: s.slot_time.slice(0, 5),
            })),
          branchSchedule: (() => {
            const bid = branchByResource.get(rid)

            if (bid) return branchScheduleById.get(bid) ?? tenantSchedule

            return tenantSchedule
          })(),
          shiftCycle: (() => {
            const r = resources.find((x) => x.id === rid)

            if (!r?.appliedTemplateId || !r.cycleStartDate) return null
            const cycleLength = shiftTemplateMeta.get(r.appliedTemplateId)
            const slotsByDayIndex = shiftSlotsByTemplate.get(r.appliedTemplateId)

            if (!cycleLength || !slotsByDayIndex) return null

            return { cycleStartDate: r.cycleStartDate, cycleLength, slotsByDayIndex }
          })(),
        }

        slotDataByResource.set(rid, data)
      }

      // ─── Записи на дату по ресурсам ───────────────────────
      for (const a of bundle.appointments) {
        if (!a.resource_id) continue
        const arr = appointmentsByResource.get(a.resource_id) ?? []

        arr.push({
          id: a.id,
          startsAt: a.starts_at,
          endsAt: a.actual_ends_at ?? a.ends_at,
        })
        appointmentsByResource.set(a.resource_id, arr)
      }

      ready.value = true
    } finally {
      loading.value = false
    }
  }

  const isCompetent = (resourceId: string, serviceId: string): boolean => competencyByResource.get(resourceId)?.has(serviceId) ?? false

  const isFree = (
    resourceId: string,
    startsAt: string,
    endsAt: string,
    excludeApptId?: string,
  ): { free: boolean; conflictId: string | null } => {
    const appts = appointmentsByResource.get(resourceId) ?? []
    const start = new Date(startsAt).getTime()
    const end = new Date(endsAt).getTime()

    for (const a of appts) {
      if (excludeApptId && a.id === excludeApptId) continue
      const aStart = new Date(a.startsAt).getTime()
      const aEnd = new Date(a.endsAt).getTime()

      if (aStart < end && aEnd > start) return { free: false, conflictId: a.id }
    }

    return { free: true, conflictId: null }
  }

  const isWorking = (resourceId: string, date: string, duration: number, slotStep: number): boolean => {
    const data = slotDataByResource.get(resourceId)

    if (!data) return false
    const tz = tenantStore.tenant.timezone
    const slots = getResourceSlotsForDate(date, data, [], duration, slotStep, tz, 1)

    return slots.length > 0
  }

  /**
   * Ближайший свободный слот для ресурса в этот же день, начиная с afterTime
   * (включительно). null если в этот день больше нет слотов.
   */
  const nextFreeSlotSameDay = (
    resourceId: string,
    date: string,
    duration: number,
    slotStep: number,
    afterTime: string,
    excludeApptId?: string,
  ): string | null => {
    const data = slotDataByResource.get(resourceId)

    if (!data) return null
    const appts: AppointmentInterval[] = (appointmentsByResource.get(resourceId) ?? [])
      .filter((a) => !excludeApptId || a.id !== excludeApptId)
      .map((a) => ({ startsAt: a.startsAt, endsAt: a.endsAt }))

    const tz = tenantStore.tenant.timezone
    const slots = getResourceSlotsForDate(date, data, appts, duration, slotStep, tz, 1)

    return slots.find((s) => s >= afterTime) ?? null
  }

  const checkResource = (
    resourceId: string,
    serviceId: string,
    startsAt: string,
    endsAt: string,
    date: string,
    duration: number,
    slotStep: number,
    excludeApptId?: string,
  ): ResourceCheckResult => {
    const competent = isCompetent(resourceId, serviceId)
    const working = isWorking(resourceId, date, duration, slotStep)
    const { free, conflictId } = isFree(resourceId, startsAt, endsAt, excludeApptId)

    let reason: ResourceCheckResult['reason'] = 'ok'

    if (!competent) reason = 'not-competent'
    else if (!working) reason = 'day-off'
    else if (!free) reason = 'busy'

    return { competent, working, free, conflictId, reason }
  }

  return {
    loading,
    ready,
    currentDate,
    loadForDate,
    isCompetent,
    isFree,
    isWorking,
    nextFreeSlotSameDay,
    checkResource,
  }
}
