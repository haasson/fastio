/** "1 мар 2024" — короткий месяц. Принимает ISO string или bare "YYYY-MM-DD". */
export const formatDate = (iso: string): string =>
  new Date(iso.includes('T') ? iso : iso + 'T12:00:00')
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })

/** "1 мар" — без года */
export const formatDateShort = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

/** "пн, 15 мар" — короткий день недели + дата */
export const formatDateWeekday = (dateStr: string): string =>
  new Date(dateStr + 'T12:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })

/** "1 марта 2024" — полный месяц. Принимает ISO string или timestamp. */
export const formatDateLong = (isoOrTs: string | number): string =>
  new Date(isoOrTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

/** "1 марта" — полный месяц без года. Принимает ISO string или timestamp. */
export const formatDateMonthDay = (isoOrTs: string | number): string =>
  new Date(isoOrTs).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })

/** "1 марта, 14:30" — дата с временем, полный месяц */
export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/**
 * "YYYY-MM-DD" → timestamp (полдень local time, чтобы избежать UTC-сдвига).
 * Использовать везде вместо `new Date(dateStr + 'T12:00:00').getTime()`.
 */
export const dateStrToTs = (dateStr: string): number =>
  new Date(dateStr + 'T12:00:00').getTime()

/**
 * timestamp → "YYYY-MM-DD" (local time).
 * Использовать везде вместо toISOString() — она возвращает UTC и может дать неверную дату.
 */
export const formatDateStr = (ts: number): string => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Сегодняшняя дата как "YYYY-MM-DD" в local time */
export const todayStr = (): string => formatDateStr(Date.now())

/** ISO string → timestamp (ms) */
export const isoToTs = (iso: string | null): number | null =>
  iso ? new Date(iso).getTime() : null

/** timestamp (ms) → ISO string */
export const tsToIso = (ts: number | null): string | null =>
  ts ? new Date(ts).toISOString() : null

/**
 * timestamp (ms) → ISO string конца дня (23:59:59.999 local time).
 * Используется для active_to в акциях/промокодах: пикер возвращает полночь,
 * но акция должна работать весь выбранный день, а не умирать в 00:00.
 */
export const tsToIsoEndOfDay = (ts: number | null): string | null => {
  if (!ts) return null
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

/**
 * Относительное время: "только что", "5 мин назад", "2 ч назад",
 * или полная дата для старых событий.
 */
/** "30 мин", "1 ч", "1 ч 30 мин" — человекочитаемая длительность в минутах */
export function formatMinutes(m: number): string {
  if (m < 60) return `${m} мин`
  if (m % 60 === 0) return `${m / 60} ч`
  return `${Math.floor(m / 60)} ч ${m % 60} мин`
}

export const formatRelativeTime = (isoDate: string, now: Date): string => {
  const diff = now.getTime() - new Date(isoDate).getTime()
  const min = Math.floor(diff / 60_000)

  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`

  const h = Math.floor(min / 60)

  if (h < 24) return `${h} ч назад`

  return new Date(isoDate).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
