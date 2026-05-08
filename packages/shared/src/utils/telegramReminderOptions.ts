export type ReminderOption = { label: string; minutes: number }

export const REMINDER_OPTIONS: ReminderOption[] = [
  { label: 'За 30 минут', minutes: 30 },
  { label: 'За 2 часа', minutes: 120 },
  { label: 'За 1 день', minutes: 1440 },
  { label: 'За 2 дня', minutes: 2880 },
]

export const MAX_REMINDER_MINUTES = Math.max(...REMINDER_OPTIONS.map((o) => o.minutes))

/** Время жизни одноразового deep-link токена напоминания. */
export const REMINDER_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** UUID v4 — для валидации appointmentId в storefront-эндпоинтах. */
export const REMINDER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 22-символьный base64url-токен (16 байт энтропии). Telegram разрешает callback_data
 * до 64 байт, поэтому строгая длина важна — payload `remind_<token>_<minutes>` ≤ 36 байт.
 */
export const REMINDER_TOKEN_RE = /^[A-Za-z0-9_-]{22}$/

export function isValidReminderMinutes(minutes: number): boolean {
  return REMINDER_OPTIONS.some((o) => o.minutes === minutes)
}

/** 2×2 grid с вариантами напоминания для inline-клавиатуры Telegram. */
export function buildReminderKeyboard(token: string) {
  const row1 = REMINDER_OPTIONS.slice(0, 2).map((opt) => ({
    text: opt.label,
    callback_data: `remind_${token}_${opt.minutes}`,
  }))
  const row2 = REMINDER_OPTIONS.slice(2).map((opt) => ({
    text: opt.label,
    callback_data: `remind_${token}_${opt.minutes}`,
  }))
  return { inline_keyboard: [row1, row2] }
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Локализованное представление даты/времени записи для сообщений в Telegram. */
export function formatAppointmentDateTime(startsAt: Date): { dateStr: string; timeStr: string } {
  return {
    dateStr: startsAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
    timeStr: startsAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  }
}

/** Текст сообщения «выбери, за сколько напомнить» — общий для admin webhook и storefront API. */
export function buildReminderOfferText(serviceName: string, dateStr: string, timeStr: string): string {
  return `📅 Запись: <b>${escapeHtml(serviceName)}</b>\n${dateStr} в ${timeStr}\n\nЗа сколько напомнить?`
}
