import type {
  Resource, Service, ResourceSlotData, AppointmentInterval,
  GroupSlotsResult, WorkingHoursSchedule,
} from '@fastio/shared'
import {
  findGroupSlotsWithFallback, getBranchHoursForDow, getEffectiveServiceIds,
  timeToMinutes, addDaysToDateStr, localDateTimeToUtcIso, DEFAULT_TIMEZONE,
  DEFAULT_WORKING_DAY_MINUTES, sliceTime,
} from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'

export type GroupSlotSearchInput = {
  date: string // "YYYY-MM-DD"
  branchId?: string | null
  slotStepMinutes: number
  // Услуги в порядке оказания. duration берётся из переданной услуги, чтобы
  // вызывающая сторона могла подменить (например, при кастомной длительности).
  services: Array<{
    serviceId: string
    duration: number
    preferredResourceId: string | null
  }>
  // Активные ресурсы-кандидаты. Обычно `useTenantStore` + `useResources()`.
  candidateResources: Resource[]
  // Полный список услуг — нужен чтобы развернуть категории ресурсов в эффективные
  // serviceId через `getEffectiveServiceIds` (как в storefront-endpoint).
  allServices: Service[]
  // Если передан — этот appointment исключается из проверки конфликтов.
  // Нужно при перекладке слота существующей записи: её собственный слот не должен
  // считаться занятым ею же, иначе подсветка её же текущего слота среди чипсов
  // никогда не пройдёт.
  excludeAppointmentId?: string | null
}

/**
 * Admin-аналог storefront `/api/appointments/group-slots`. Загружает данные
 * (расписания, занятость, компетенции) через `bulkLoadAvailability` и
 * вызывает shared `findGroupSlotsWithFallback`.
 *
 * Используется в admin-редакторе записи при подборе времени для группы услуг
 * (несколько услуг подряд с возможностью замены исполнителя).
 */
export function useGroupSlotSearch() {
  const api = useDatabase()
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()

  const findSlots = async (input: GroupSlotSearchInput): Promise<GroupSlotsResult> => {
    const tenantId = tenantStore.currentTenantId

    if (!tenantId) return { type: 'slots', entries: [] }

    const tz = tenantStore.tenant?.timezone ?? DEFAULT_TIMEZONE
    const candidateIds = input.candidateResources.map((r) => r.id)

    if (candidateIds.length === 0) return { type: 'slots', entries: [] }

    const dayStartUtc = localDateTimeToUtcIso(input.date, '00:00', tz)
    const dayEndUtc = localDateTimeToUtcIso(addDaysToDateStr(input.date, 1), '00:00', tz)

    const shiftTemplateIds = Array.from(new Set(
      input.candidateResources
        .filter((r) => r.appliedTemplateId && r.cycleStartDate)
        .map((r) => r.appliedTemplateId as string),
    ))

    const bundle = await api.resources.bulkLoadAvailability({
      tenantId,
      resourceIds: candidateIds,
      date: input.date,
      dayStartUtc,
      dayEndUtc,
      shiftTemplateIds,
    })

    // ─── Shift cycles: template_id → { dayIndex → {open, close} | null } ──
    const shiftHoursByTemplate = new Map<string, Record<number, { openTime: string; closeTime: string } | null>>()

    for (const row of bundle.shiftTemplateDays) {
      const map = shiftHoursByTemplate.get(row.template_id) ?? {}

      if (!row.is_working || !row.open_time || !row.close_time) {
        map[row.day_index] = null
      } else {
        map[row.day_index] = {
          openTime: row.open_time.slice(0, 5),
          closeTime: row.close_time.slice(0, 5),
        }
      }
      shiftHoursByTemplate.set(row.template_id, map)
    }
    const shiftCycleLengthById = new Map<string, number>(
      bundle.shiftTemplates.map((t) => [t.id, t.cycle_length as number]),
    )

    // ─── Competency: resourceId → Set<serviceId> ───────────────────
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
    const servicesForCompute = input.allServices.map((s) => ({ id: s.id, categoryId: s.categoryId }))
    const competencyByResource = new Map<string, Set<string>>()

    for (const rid of candidateIds) {
      const ids = getEffectiveServiceIds(
        explicitByResource.get(rid) ?? [],
        categoryIdsByResource.get(rid) ?? [],
        servicesForCompute,
      )

      competencyByResource.set(rid, new Set(ids))
    }

    // ─── Branch fallback schedule per resource ─────────────────────
    const branchByResource = new Map<string, string>()

    for (const row of bundle.branchLinks) {
      if (!branchByResource.has(row.resource_id)) branchByResource.set(row.resource_id, row.branch_id)
    }
    const tenantSchedule = tenantStore.tenant?.workingHoursSchedule ?? null
    const branchScheduleById = new Map<string, WorkingHoursSchedule | null>()

    for (const b of branchStore.branches) {
      branchScheduleById.set(b.id, b.workingHoursSchedule ?? null)
    }

    // ─── ResourceSlotData + appointments per resource ──────────────
    const slotDataByResource = new Map<string, ResourceSlotData>()
    const appointmentsByResource = new Map<string, AppointmentInterval[]>()

    for (const r of input.candidateResources) {
      const rid = r.id
      const data: ResourceSlotData = {
        schedules: bundle.schedules.filter((s) => s.resource_id === rid).map((s) => ({
          id: s.id,
          resourceId: s.resource_id,
          dayOfWeek: s.day_of_week,
          isWorking: s.is_working,
          openTime: sliceTime(s.open_time),
          closeTime: sliceTime(s.close_time),
        })),
        disabledSlots: bundle.disabledSlots.filter((s) => s.resource_id === rid).map((s) => ({
          id: s.id,
          resourceId: s.resource_id,
          dayOfWeek: s.day_of_week,
          slotTime: s.slot_time.slice(0, 5),
        })),
        dateOverrides: bundle.dateOverrides.filter((s) => s.resource_id === rid).map((s) => ({
          id: s.id,
          resourceId: s.resource_id,
          date: s.date,
          isWorking: s.is_working,
          openTime: sliceTime(s.open_time),
          closeTime: sliceTime(s.close_time),
        })),
        dateDisabledSlots: bundle.dateDisabledSlots.filter((s) => s.resource_id === rid).map((s) => ({
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
          if (!r.appliedTemplateId || !r.cycleStartDate) return null
          const cycleLength = shiftCycleLengthById.get(r.appliedTemplateId)
          const hoursByDayIndex = shiftHoursByTemplate.get(r.appliedTemplateId)

          if (!cycleLength || !hoursByDayIndex) return null

          return { cycleStartDate: r.cycleStartDate, cycleLength, hoursByDayIndex }
        })(),
      }

      slotDataByResource.set(rid, data)
    }

    for (const a of bundle.appointments) {
      if (!a.resource_id) continue
      if (input.excludeAppointmentId && a.id === input.excludeAppointmentId) continue
      const arr = appointmentsByResource.get(a.resource_id) ?? []

      arr.push({ startsAt: a.starts_at, endsAt: a.actual_ends_at ?? a.ends_at })
      appointmentsByResource.set(a.resource_id, arr)
    }

    // ─── Items для findGroupSlotsWithFallback ──────────────────────
    const items = input.services.map((svc) => {
      const allResourceIds = input.candidateResources
        .filter((r) => competencyByResource.get(r.id)?.has(svc.serviceId))
        .map((r) => r.id)
      const resourceNames = new Map<string, string>()

      for (const r of input.candidateResources) {
        if (allResourceIds.includes(r.id)) resourceNames.set(r.id, r.name)
      }

      return {
        serviceId: svc.serviceId,
        duration: svc.duration,
        allResourceIds,
        preferredResourceId: svc.preferredResourceId,
        resourceNames,
      }
    })

    // ─── Branch schedule + working day minutes ─────────────────────
    const branchId = input.branchId ?? null
    const branchSchedule = branchId
      ? (branchScheduleById.get(branchId) ?? tenantSchedule)
      : tenantSchedule

    let workingDayMinutes = DEFAULT_WORKING_DAY_MINUTES

    if (branchSchedule) {
      const dow = new Date(input.date + 'T12:00:00').getDay()
      const hours = getBranchHoursForDow(branchSchedule, dow)

      if (hours) {
        const openMin = timeToMinutes(hours.open)
        const closeMin = timeToMinutes(hours.close)

        if (closeMin > openMin) workingDayMinutes = closeMin - openMin
      }
    }

    return findGroupSlotsWithFallback(
      items,
      input.date,
      slotDataByResource,
      appointmentsByResource,
      { slotStep: input.slotStepMinutes, timezone: tz },
      workingDayMinutes,
      branchSchedule,
    )
  }

  return { findSlots }
}
