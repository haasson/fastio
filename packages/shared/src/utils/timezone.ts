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
  // Россия
  { value: 'Europe/Kaliningrad', label: 'UTC+2 — Калининград' },
  { value: 'Europe/Moscow', label: 'UTC+3 — Москва, Санкт-Петербург' },
  { value: 'Europe/Samara', label: 'UTC+4 — Самара, Ижевск' },
  { value: 'Asia/Yekaterinburg', label: 'UTC+5 — Екатеринбург' },
  { value: 'Asia/Omsk', label: 'UTC+6 — Омск' },
  { value: 'Asia/Krasnoyarsk', label: 'UTC+7 — Красноярск' },
  { value: 'Asia/Irkutsk', label: 'UTC+8 — Иркутск' },
  { value: 'Asia/Yakutsk', label: 'UTC+9 — Якутск' },
  { value: 'Asia/Vladivostok', label: 'UTC+10 — Владивосток' },
  { value: 'Asia/Magadan', label: 'UTC+11 — Магадан' },
  { value: 'Asia/Kamchatka', label: 'UTC+12 — Камчатка' },
  // СНГ
  { value: 'Europe/Minsk', label: 'UTC+3 — Минск' },
  { value: 'Asia/Almaty', label: 'UTC+6 — Алматы' },
  { value: 'Asia/Tashkent', label: 'UTC+5 — Ташкент' },
  { value: 'Asia/Tbilisi', label: 'UTC+4 — Тбилиси' },
  { value: 'Asia/Yerevan', label: 'UTC+4 — Ереван' },
  { value: 'Asia/Baku', label: 'UTC+4 — Баку' },
  { value: 'Europe/Chisinau', label: 'UTC+2 — Кишинёв' },
  { value: 'Asia/Bishkek', label: 'UTC+6 — Бишкек' },
  { value: 'Asia/Dushanbe', label: 'UTC+5 — Душанбе' },
  { value: 'Asia/Ashgabat', label: 'UTC+5 — Ашхабад' },
  // Европа
  { value: 'Europe/London', label: 'UTC+0 — Лондон' },
  { value: 'Europe/Berlin', label: 'UTC+1 — Берлин, Париж' },
  { value: 'Europe/Istanbul', label: 'UTC+3 — Стамбул' },
  // Азия
  { value: 'Asia/Dubai', label: 'UTC+4 — Дубай' },
  { value: 'Asia/Bangkok', label: 'UTC+7 — Бангкок' },
  { value: 'Asia/Shanghai', label: 'UTC+8 — Пекин, Шанхай' },
  { value: 'Asia/Tokyo', label: 'UTC+9 — Токио' },
  // Америка (на будущее)
  { value: 'America/New_York', label: 'UTC-5 — Нью-Йорк' },
  { value: 'America/Los_Angeles', label: 'UTC-8 — Лос-Анджелес' },
]
