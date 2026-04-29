import { ref, watch, type Ref } from 'vue'
import type {
  Resource, WorkingHoursSchedule,
} from '@fastio/shared'
import {
  todayInTz, utcIsoToLocalDateTime, timeToMinutes, getDaySchedule, getIsoDayForDate,
} from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useDatabase } from '~/composables/data/useDatabase'

const sliceTime = (v: unknown): string | null => typeof v === 'string' ? v.slice(0, 5) : null

export type PresenceStatus = 'working' | 'off-hours' | 'absent' | 'hidden'

/**
 * Считает текущий рабочий статус для списка ресурсов:
 * - hidden — ресурс is_active=false (выключен админом)
 * - absent — на сегодня есть override is_working=false (отпуск/болезнь)
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

  const nextDayStr = (date: string): string => {
    const [y, m, d] = date.split('-').map(Number)
    const next = new Date(y, m - 1, d + 1)

    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
  }

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
      const shiftSlotsByTemplate = new Map<string, Record<number, string[]>>()

      for (const row of bundle.shiftTemplateSlots) {
        const map = shiftSlotsByTemplate.get(row.template_id) ?? {}
        const arr = map[row.day_index] ?? []

        arr.push(row.slot_time.slice(0, 5))
        map[row.day_index] = arr
        shiftSlotsByTemplate.set(row.template_id, map)
      }
      for (const [, byDay] of shiftSlotsByTemplate) {
        for (const k of Object.keys(byDay)) byDay[Number(k)].sort()
      }

      const nowIsoUtc = new Date().toISOString()
      const { timeStr: nowLocalTime } = utcIsoToLocalDateTime(nowIsoUtc, tz)
      const nowMin = timeToMinutes(nowLocalTime)

      const result = new Map<string, PresenceStatus>()
      const absentUntil = new Map<string, string>()

      // Группируем overrides по resource_id, отсортированные по дате.
      const overridesByResource = new Map<string, Array<{ date: string; is_working: boolean; open_time: string | null; close_time: string | null }>>()

      for (const row of bundle.dateOverrides) {
        const arr = overridesByResource.get(row.resource_id) ?? []

        arr.push({ date: row.date, is_working: row.is_working, open_time: row.open_time, close_time: row.close_time })
        overridesByResource.set(row.resource_id, arr)
      }

      for (const r of resources.value) {
        if (!r.isActive) {
          result.set(r.id, 'hidden')
          continue
        }

        const myOverrides = overridesByResource.get(r.id) ?? []
        const todayOverride = myOverrides.find((o) => o.date === today)

        if (todayOverride && !todayOverride.is_working) {
          result.set(r.id, 'absent')
          // Ищем последний подряд идущий день отсутствия начиная с сегодня.
          let last = today
          let probe = nextDayStr(today)

          for (let i = 1; i < myOverrides.length; i++) {
            const o = myOverrides.find((x) => x.date === probe)

            if (!o || o.is_working) break
            last = probe
            probe = nextDayStr(probe)
          }
          absentUntil.set(r.id, last)
          continue
        }

        // Определяем рабочее окно на сегодня.
        let openTime: string | null = null
        let closeTime: string | null = null

        if (todayOverride?.is_working) {
          openTime = sliceTime(todayOverride.open_time)
          closeTime = sliceTime(todayOverride.close_time)
        } else if (r.appliedTemplateId && r.cycleStartDate) {
          const cycleLength = shiftCycleLengthById.get(r.appliedTemplateId)
          const slotsByDay = shiftSlotsByTemplate.get(r.appliedTemplateId)

          if (cycleLength && slotsByDay) {
            const cycleStart = new Date(r.cycleStartDate + 'T00:00:00Z').getTime()
            const todayUtc = new Date(today + 'T00:00:00Z').getTime()
            const offset = Math.floor((todayUtc - cycleStart) / 86_400_000)
            const idx = ((offset % cycleLength) + cycleLength) % cycleLength
            const slots = slotsByDay[idx] ?? []

            if (slots.length > 0) {
              openTime = slots[0]
              closeTime = '23:59'
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
              const day = getDaySchedule(sch, isoDay)

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
