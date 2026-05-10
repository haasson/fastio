import { ref, watch, type Ref } from 'vue'
import type {
  Resource, WorkingHoursSchedule,
} from '@fastio/shared'
import {
  todayInTz, utcIsoToLocalDateTime, timeToMinutes, getScheduleForDate, getIsoDayForDate, sliceTime,
} from '@fastio/shared'
import { useTenantStore } from '~/shared/stores/tenant'
import { useBranchStore } from '~/shared/stores/branch'
import { useDatabase } from '~/shared/data/useDatabase'

export type PresenceStatus = 'working' | 'off-hours' | 'absent' | 'hidden'

/**
 * Считает текущий рабочий статус для списка ресурсов:
 * - hidden — ресурс is_active=false (выключен админом)
 * - absent — сегодня попадает в период unavailability (отпуск/больничный/обучение)
 * - off-hours — сейчас вне рабочего окна (или сегодня выходной по графику/циклу)
 * - working — сейчас в рабочем окне
 *
 * Грузит данные одной пачкой запросов на текущую дату — для отрисовки
 * плашек в списке staff/objects.
 */
export function useResourcePresence(resources: Ref<Resource[]>) {
  const tenantStore = useTenantStore()
  const branchStore = useBranchStore()
  const api = useDatabase()

  const statusByResource = ref<Map<string, PresenceStatus>>(new Map())
  const absentUntilByResource = ref<Map<string, string>>(new Map())
  const loading = ref(false)

  const compute = async () => {
    if (!tenantStore.currentTenantId) return
    const tz = tenantStore.tenant.timezone
    const today = todayInTz(tz)
    const ids = resources.value.map((r) => r.id)

    if (ids.length === 0) {
      statusByResource.value = new Map()

      return
    }

    loading.value = true
    try {
      // Resources с привязкой к shift-шаблону.
      const shiftIds = Array.from(new Set(
        resources.value
          .filter((r) => r.appliedTemplateId && r.cycleStartDate)
          .map((r) => r.appliedTemplateId as string),
      ))

      const bundle = await api.resources.bulkLoadPresence({
        resourceIds: ids,
        todayDate: today,
        shiftTemplateIds: shiftIds,
      })

      const branchByResource = new Map<string, string>()

      for (const row of bundle.branchLinks) {
        if (!branchByResource.has(row.resource_id)) branchByResource.set(row.resource_id, row.branch_id)
      }

      const branchScheduleById = new Map<string, WorkingHoursSchedule | null>()

      for (const b of branchStore.branches) {
        branchScheduleById.set(b.id, b.workingHoursSchedule ?? null)
      }
      const tenantSchedule = tenantStore.tenant.workingHoursSchedule ?? null

      const shiftCycleLengthById = new Map<string, number>(
        bundle.shiftTemplates.map((t) => [t.id, t.cycle_length as number]),
      )
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

      const nowIsoUtc = new Date().toISOString()
      const { timeStr: nowLocalTime } = utcIsoToLocalDateTime(nowIsoUtc, tz)
      const nowMin = timeToMinutes(nowLocalTime)

      const result = new Map<string, PresenceStatus>()
      const absentUntil = new Map<string, string>()

      // bulkLoadPresence уже отфильтровал unavailability по сегодня (overlap).
      // Группируем по resource_id; в случае нескольких пересекающихся периодов
      // (редкость, но возможна) для absentUntil берём максимальный dateTo.
      const unavailByResource = new Map<string, string>()

      for (const u of bundle.unavailability) {
        const prev = unavailByResource.get(u.resourceId)

        if (!prev || u.dateTo > prev) unavailByResource.set(u.resourceId, u.dateTo)
      }

      // Override на сегодня может задавать нестандартные часы (is_working=true);
      // is_working=false в overrides больше не пишется (см. resource_unavailability).
      const overrideByResource = new Map<string, { open_time: string | null; close_time: string | null }>()

      for (const row of bundle.dateOverrides) {
        if (row.date === today && row.is_working) {
          overrideByResource.set(row.resource_id, { open_time: row.open_time, close_time: row.close_time })
        }
      }

      for (const r of resources.value) {
        if (!r.isActive) {
          result.set(r.id, 'hidden')
          continue
        }

        const absentUntilDate = unavailByResource.get(r.id)

        if (absentUntilDate) {
          result.set(r.id, 'absent')
          absentUntil.set(r.id, absentUntilDate)
          continue
        }

        // Определяем рабочее окно на сегодня.
        let openTime: string | null = null
        let closeTime: string | null = null

        const todayOverride = overrideByResource.get(r.id)

        if (todayOverride) {
          openTime = sliceTime(todayOverride.open_time)
          closeTime = sliceTime(todayOverride.close_time)
        } else if (r.appliedTemplateId && r.cycleStartDate) {
          const cycleLength = shiftCycleLengthById.get(r.appliedTemplateId)
          const hoursByDay = shiftHoursByTemplate.get(r.appliedTemplateId)

          if (cycleLength && hoursByDay) {
            const cycleStart = new Date(r.cycleStartDate + 'T00:00:00Z').getTime()
            const todayUtc = new Date(today + 'T00:00:00Z').getTime()
            const offset = Math.floor((todayUtc - cycleStart) / 86_400_000)
            const idx = ((offset % cycleLength) + cycleLength) % cycleLength
            const hours = hoursByDay[idx] ?? null

            if (hours) {
              openTime = hours.openTime
              closeTime = hours.closeTime
            }
          }
        } else {
          // ISO-день (1=Пн..7=Вс) считаем по строке даты, а не по `new Date()` —
          // это убирает зависимость от browser tz при крайних часах суток.
          const isoDay = Number(getIsoDayForDate(today))
          const dow = isoDay === 7 ? 0 : isoDay // 0=Sun..6=Sat для совместимости с day_of_week
          const myRows = bundle.schedules
            .filter((s) => s.resource_id === r.id)

          if (myRows.length > 0) {
            // Если у ресурса есть свой weekly-график, ищем строку именно
            // по сегодняшнему dow; нет строки или is_working=false → выходной.
            const sched = myRows.find((s) => s.day_of_week === dow)

            if (sched && sched.is_working) {
              openTime = sliceTime(sched.open_time)
              closeTime = sliceTime(sched.close_time)
            }
          } else {
            // График у ресурса не задан → наследуем филиал/тенант.
            const bid = branchByResource.get(r.id)
            const sch = bid
              ? branchScheduleById.get(bid) ?? tenantSchedule
              : tenantSchedule

            if (sch) {
              const day = getScheduleForDate(sch, today)

              if (!day.dayOff && day.open && day.close) {
                if (day.allDay) {
                  // 24/7 — точно работает.
                  openTime = '00:00'
                  closeTime = '23:59'
                } else {
                  openTime = day.open
                  closeTime = day.close
                }
              }
            }
          }
        }

        if (!openTime || !closeTime) {
          result.set(r.id, 'off-hours')
          continue
        }
        const openMin = timeToMinutes(openTime)
        const closeMin = timeToMinutes(closeTime)

        result.set(r.id, nowMin >= openMin && nowMin < closeMin ? 'working' : 'off-hours')
      }

      statusByResource.value = result
      absentUntilByResource.value = absentUntil
    } finally {
      loading.value = false
    }
  }

  watch(resources, compute, { immediate: true })

  return { statusByResource, absentUntilByResource, loading, refresh: compute }
}
