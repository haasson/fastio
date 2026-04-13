/**
 * "Сейчас" в таймзоне тенанта как "YYYY-MM-DD".
 * Используем Intl.DateTimeFormat для корректного определения даты
 * без внешних библиотек.
 */
export function todayInTz(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const d = parts.find(p => p.type === 'day')!.value

  return `${y}-${m}-${d}`
}

/**
 * Текущее время в таймзоне тенанта как "HH:MM".
 */
export function nowTimeInTz(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const h = parts.find(p => p.type === 'hour')!.value
  const m = parts.find(p => p.type === 'minute')!.value

  return `${h}:${m}`
}

/**
 * ISO-день недели (1=Пн..7=Вс) для даты в таймзоне тенанта.
 * dateStr: "YYYY-MM-DD" — дата в таймзоне тенанта (наивная).
 */
export function getIsoDayForDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const js = d.getDay() // 0=Sun, 1=Mon...
  return String(js === 0 ? 7 : js)
}

/**
 * Прибавляет N дней к строке "YYYY-MM-DD" и возвращает результат в том же формате.
 * Чистая строковая арифметика через UTC — не зависит от локальной таймзоны сервера.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Конвертирует наивную дату + время в таймзоне тенанта в UTC ISO string.
 * dateStr: "YYYY-MM-DD", timeStr: "HH:mm", timezone: IANA.
 */
export function localDateTimeToUtcIso(dateStr: string, timeStr: string, timezone: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, m] = timeStr.split(':').map(Number)

  // Шаг 1: "прощупываем" UTC-момент, взяв желаемую дату+время как UTC
  const probe = new Date(Date.UTC(y, mo - 1, d, h, m, 0))

  // Шаг 2: смотрим, какое местное время в timezone соответствует этому UTC-моменту
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(probe)
  const get = (type: string) => +parts.find(p => p.type === type)!.value
  const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))

  // Шаг 3: разница — это UTC-смещение таймзоны в этот момент
  const offset = probe.getTime() - localAsUtc

  // Шаг 4: реальный UTC = желаемое местное (как UTC) + смещение
  return new Date(probe.getTime() + offset).toISOString()
}

/**
 * Конвертирует UTC ISO string в наивную дату + время в таймзоне тенанта.
 * Возвращает { dateStr: "YYYY-MM-DD", timeStr: "HH:mm" }.
 */
export function utcIsoToLocalDateTime(isoStr: string, timezone: string): { dateStr: string; timeStr: string } {
  const d = new Date(isoStr)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)!.value

  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    timeStr: `${get('hour')}:${get('minute')}`,
  }
}

/** "HH:MM" → минуты от начала суток */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Минуты (в т.ч. > 1440 для overnight) → "HH:MM", нормализованное */
export function minutesToTimeStr(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Генерирует временные слоты между open и close с шагом step.
 * Корректно обрабатывает overnight-расписание (close < open).
 * closeBufferMinutes — сколько минут до закрытия обрезаем слоты.
 * Возвращает { timeStr: "HH:MM", nextDay: boolean }[].
 */
export function generateTimeSlots(
  open: string,
  close: string,
  step: number,
  closeBufferMinutes = 0,
): { timeStr: string; nextDay: boolean }[] {
  const openMin = timeToMinutes(open)
  let closeMin = timeToMinutes(close)
  const overnight = closeMin <= openMin
  if (overnight) closeMin += 1440

  const effectiveClose = closeMin - closeBufferMinutes
  const startMin = Math.ceil(openMin / step) * step
  const slots: { timeStr: string; nextDay: boolean }[] = []

  for (let m = startMin; m <= effectiveClose; m += step) {
    slots.push({ timeStr: minutesToTimeStr(m), nextDay: overnight && m >= 1440 })
  }
  return slots
}

/**
 * Проверяет, доступен ли ASAP-заказ прямо сейчас.
 * Учитывает рабочие часы, overnight, буфер до закрытия.
 */
export function isAsapAvailable(
  schedule: import('../types/tenant').WorkingHoursSchedule | null | undefined,
  closeBufferMinutes: number,
  timezone: string,
): boolean {
  if (!schedule) return true
  if (schedule.default.allDay) return true

  const today = todayInTz(timezone)
  const [nowH, nowM] = nowTimeInTz(timezone).split(':').map(Number)
  const nowMinutes = nowH * 60 + nowM

  const isoDay = Number(getIsoDayForDate(today))
  const day = schedule.days[String(isoDay)] ?? schedule.default
  if (day.dayOff) return false

  const openMin = timeToMinutes(day.open)
  const rawCloseMin = timeToMinutes(day.close)
  const overnight = rawCloseMin <= openMin

  const isOpen = overnight
    ? (nowMinutes >= openMin || nowMinutes < rawCloseMin)
    : (nowMinutes >= openMin && nowMinutes < rawCloseMin)
  if (!isOpen) return false

  const closeMin = overnight ? 1440 + rawCloseMin : rawCloseMin
  const effectiveNow = overnight && nowMinutes < rawCloseMin ? nowMinutes + 1440 : nowMinutes
  return effectiveNow + closeBufferMinutes < closeMin
}

/**
 * Список популярных таймзон для селектора.
 * Формат: IANA timezone → человекочитаемое название.
 *
 * // TODO: когда появятся филиалы в разных регионах,
 * // можно расширить список или сделать поиск по всем IANA-зонам
 */
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Europe/Kaliningrad', label: 'МСК−1 — Калининград' },
  { value: 'Europe/Moscow', label: 'МСК — Москва, Санкт-Петербург' },
  { value: 'Europe/Samara', label: 'МСК+1 — Самара, Ижевск' },
  { value: 'Asia/Yekaterinburg', label: 'МСК+2 — Екатеринбург, Тюмень' },
  { value: 'Asia/Omsk', label: 'МСК+3 — Омск' },
  { value: 'Asia/Krasnoyarsk', label: 'МСК+4 — Красноярск, Новосибирск' },
  { value: 'Asia/Irkutsk', label: 'МСК+5 — Иркутск' },
  { value: 'Asia/Yakutsk', label: 'МСК+6 — Якутск, Чита' },
  { value: 'Asia/Vladivostok', label: 'МСК+7 — Владивосток, Хабаровск' },
  { value: 'Asia/Magadan', label: 'МСК+8 — Магадан, Сахалин' },
  { value: 'Asia/Kamchatka', label: 'МСК+9 — Камчатка, Анадырь' },
]
