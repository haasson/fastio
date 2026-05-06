import type {
  ScheduleTemplate,
  ScheduleTemplateDay,
  ScheduleTemplateType,
} from '../types/scheduleTemplate'
import type { WorkingHours, WorkingHoursSchedule } from '../types/tenant'
import { sliceTime } from './timezone'

/**
 * Дефолтный график работы заведения. Используется как клиентский fallback
 * везде, где у тенанта/филиала ещё не сохранено `working_hours_schedule`
 * (миграция создаёт тенант с null, юзер видит дефолт в форме до save).
 *
 * 10:00–22:00 без выходных дней — типичный график общепита/салона.
 */
export const DEFAULT_WORKING_HOURS_SCHEDULE: WorkingHoursSchedule = {
  default: { open: '10:00', close: '22:00' },
  days: {},
}

export const mapScheduleTemplate = (raw: Record<string, unknown>): ScheduleTemplate => ({
  id: raw.id as string,
  tenantId: raw.tenant_id as string,
  name: raw.name as string,
  type: raw.type as ScheduleTemplateType,
  cycleLength: (raw.cycle_length as number | null) ?? null,
  referenceBranchId: (raw.reference_branch_id as string | null) ?? null,
  sortOrder: (raw.sort_order as number | null) ?? 0,
  createdAt: raw.created_at as string,
  updatedAt: raw.updated_at as string,
})

export const mapScheduleTemplateDay = (raw: Record<string, unknown>): ScheduleTemplateDay => ({
  templateId: raw.template_id as string,
  dayIndex: raw.day_index as number,
  isWorking: raw.is_working as boolean,
  openTime: sliceTime(raw.open_time),
  closeTime: sliceTime(raw.close_time),
})

/**
 * dow 0..6 (0=Sun..6=Sat) → ISO ('1'..'7') ключ в WorkingHoursSchedule.days.
 */
const dowToIso = (dow: number): string => (dow === 0 ? '7' : String(dow))

/**
 * Часы работы филиала на конкретный день недели.
 * Возвращает null, если день выходной.
 */
export const getBranchHoursForDow = (
  schedule: WorkingHoursSchedule | null,
  dow: number,
): WorkingHours | null => {
  if (!schedule) return null
  const override = schedule.days[dowToIso(dow)]
  const hours = override ?? schedule.default
  if (!hours) return null
  if (override?.dayOff) return null
  if (hours.allDay) return { open: '00:00', close: '24:00' }
  return hours
}

/**
 * Самое широкое окно работы филиала за все рабочие дни (для shift-сетки).
 * min(open) и max(close) по дням недели, где не выходной.
 */
export const getBranchWidestWindow = (
  schedule: WorkingHoursSchedule | null,
): { open: string; close: string } | null => {
  if (!schedule) return null
  let openMin: string | null = null
  let closeMax: string | null = null
  for (let dow = 0; dow < 7; dow++) {
    const h = getBranchHoursForDow(schedule, dow)
    if (!h) continue
    if (openMin === null || h.open < openMin) openMin = h.open
    if (closeMax === null || h.close > closeMax) closeMax = h.close
  }
  if (openMin === null || closeMax === null) return null
  return { open: openMin, close: closeMax }
}
