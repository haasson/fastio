import type { Resource, ResourceSlotData, WorkingHoursSchedule } from '@fastio/shared'
import { resolveResourceWorkingHours } from '@fastio/shared'
import type { AvailabilityBundle } from '~/utils/api/services/resources'

export type ResourceAvailability = {
  workingHours: { openTime: string; closeTime: string } | null
  // 'HH:MM' — нерабочие слоты ресурса на выбранную дату (объединение dow + date)
  disabledSlots: string[]
}

export type TimelineAvailability = Record<string, ResourceAvailability>

const sliceTime = (v: unknown): string | null => typeof v === 'string' ? v.slice(0, 5) : null

/**
 * Из бандла bulkLoadAvailability собирает per-resource рабочие часы и список
 * отключённых слотов на выбранную дату. Учитывает: override на дату → shift-cycle
 * → недельное расписание ресурса → расписание филиала → расписание тенанта.
 *
 * Disabled-слоты — объединение постоянных (по дню недели) и точечных (на дату).
 */
export function buildTimelineAvailability(params: {
  resources: Resource[]
  date: string
  bundle: AvailabilityBundle
  branches: Array<{ id: string; workingHoursSchedule?: WorkingHoursSchedule | null }>
  tenantSchedule: WorkingHoursSchedule | null
}): TimelineAvailability {
  const { resources, date, bundle, branches, tenantSchedule } = params

  const branchScheduleById = new Map<string, WorkingHoursSchedule | null>()

  for (const b of branches) branchScheduleById.set(b.id, b.workingHoursSchedule ?? null)

  const branchByResource = new Map<string, string>()

  for (const row of bundle.branchLinks) {
    if (!branchByResource.has(row.resource_id)) branchByResource.set(row.resource_id, row.branch_id)
  }

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

  const dow = new Date(`${date}T12:00:00`).getDay()
  const result: TimelineAvailability = {}

  for (const r of resources) {
    const data: ResourceSlotData = {
      schedules: bundle.schedules.filter((s) => s.resource_id === r.id).map((s) => ({
        id: s.id,
        resourceId: s.resource_id,
        dayOfWeek: s.day_of_week,
        isWorking: s.is_working,
        openTime: sliceTime(s.open_time),
        closeTime: sliceTime(s.close_time),
      })),
      disabledSlots: bundle.disabledSlots.filter((s) => s.resource_id === r.id).map((s) => ({
        id: s.id,
        resourceId: s.resource_id,
        dayOfWeek: s.day_of_week,
        slotTime: s.slot_time.slice(0, 5),
      })),
      dateOverrides: bundle.dateOverrides.filter((s) => s.resource_id === r.id).map((s) => ({
        id: s.id,
        resourceId: s.resource_id,
        date: s.date,
        isWorking: s.is_working,
        openTime: sliceTime(s.open_time),
        closeTime: sliceTime(s.close_time),
      })),
      dateDisabledSlots: bundle.dateDisabledSlots.filter((s) => s.resource_id === r.id).map((s) => ({
        id: s.id,
        resourceId: s.resource_id,
        date: s.date,
        slotTime: s.slot_time.slice(0, 5),
      })),
      // bundle.unavailability уже отфильтрован сервером по выбранной дате и
      // смаппен в camelCase в getAvailabilityBundleForDate — здесь только сужаем по resource.
      unavailability: bundle.unavailability.filter((u) => u.resourceId === r.id),
      branchSchedule: (() => {
        const bid = branchByResource.get(r.id)

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

    const wh = resolveResourceWorkingHours(date, data)

    const disabledByDow = data.disabledSlots.filter((s) => s.dayOfWeek === dow).map((s) => s.slotTime)
    const disabledByDate = data.dateDisabledSlots.filter((s) => s.date === date).map((s) => s.slotTime)
    const disabled = Array.from(new Set([...disabledByDow, ...disabledByDate]))

    result[r.id] = { workingHours: wh, disabledSlots: disabled }
  }

  return result
}
