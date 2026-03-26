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
