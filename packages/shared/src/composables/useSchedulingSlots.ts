import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { Tenant } from '../types/tenant'
import { getAvailableSlots } from '../utils/scheduling'
import { todayInTz, nowTimeInTz, addDaysToDateStr, DEFAULT_TIMEZONE } from '../utils/timezone'
import { timeToMinutes } from '../utils/timezone'
import { formatDateWeekday } from '../utils/date'

export function useSchedulingSlots(
  tenant: MaybeRefOrGetter<Tenant | null | undefined>,
  deliveryType: MaybeRefOrGetter<string>,
  selectedDate: MaybeRefOrGetter<string | null | undefined>,
) {
  const tenantTz = computed(() => toValue(tenant)?.timezone ?? DEFAULT_TIMEZONE)

  const leadMinutes = computed(() => {
    const cfg = toValue(tenant)?.orderSchedulingConfig
    if (!cfg) return 30
    return toValue(deliveryType) === 'delivery' ? cfg.deliveryLeadMinutes : cfg.pickupLeadMinutes
  })

  const slotStep = computed(() => toValue(tenant)?.orderSchedulingConfig?.slotStep ?? 30)

  const getSlotsForDate = (dateStr: string, nowMinutes: number | null) =>
    getAvailableSlots(dateStr, toValue(tenant)?.workingHoursSchedule, {
      step: slotStep.value,
      leadMinutes: leadMinutes.value,
      closeBufferMinutes: toValue(tenant)?.orderSchedulingConfig?.closeBufferMinutes ?? 30,
      nowMinutes,
    })

  const dateOptions = computed(() => {
    const tz = tenantTz.value
    const today = todayInTz(tz)
    const daysAhead = toValue(tenant)?.orderSchedulingConfig?.daysAhead ?? 3
    const nowMinutes = timeToMinutes(nowTimeInTz(tz))

    return Array.from({ length: daysAhead }, (_, i) => {
      const dateStr = addDaysToDateStr(today, i)
      const nowMin = i === 0 ? nowMinutes : null
      return {
        value: dateStr,
        label: i === 0 ? 'Сегодня' : formatDateWeekday(dateStr),
        disabled: getSlotsForDate(dateStr, nowMin).length === 0,
      }
    })
  })

  const timeSlots = computed(() => {
    const dateStr = toValue(selectedDate)
    if (!dateStr) return []

    const tz = tenantTz.value
    const today = todayInTz(tz)
    const isToday = dateStr === today
    const nowMinutes = isToday ? timeToMinutes(nowTimeInTz(tz)) : null

    return getSlotsForDate(dateStr, nowMinutes)
  })

  return { dateOptions, timeSlots }
}
