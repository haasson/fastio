import { defineEventHandler, getRouterParam, getRequestHeader, sendRedirect, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { reportError } from '@fastio/shared/observability'

const PHONE_FORMAT = /^\+?\d+$/

// Хардкод-baseline на случай если adminUrl в runtimeConfig пуст. Производственный
// origin админки + Telegram-домены (inline-button «Позвонить» из бота открывает
// URL без Referer'а в Telegram Desktop, но через t.me redirect в web/мобиле —
// тогда Referer === https://t.me).
const DEFAULT_ALLOWED_ORIGINS = [
  'https://admin.fastio.ru',
  'https://t.me',
  'https://web.telegram.org',
]

function isAllowedReferer(referer: string | undefined, adminUrl: string): boolean {
  // Нет Referer'а — это нормальный кейс для Telegram Desktop/mobile native клиента,
  // который вообще не шлёт Referer при открытии URL из inline-button. Без этого
  // блока легитимные клики «Позвонить» из бота получали бы 403.
  if (!referer) return true

  const allowed = adminUrl
    ? [adminUrl.replace(/\/$/, ''), ...DEFAULT_ALLOWED_ORIGINS]
    : DEFAULT_ALLOWED_ORIGINS

  return allowed.some((origin) => referer.startsWith(`${origin}/`) || referer === origin)
}

export default defineEventHandler((event) => {
  const raw = getRouterParam(event, 'phone') ?? ''

  if (!PHONE_FORMAT.test(raw)) {
    reportError(new Error(`[tel-redirect] invalid phone format: ${raw.slice(0, 32)}`))
    throw createError({ statusCode: 400, message: 'Invalid phone format' })
  }

  const referer = getRequestHeader(event, 'referer')
  const config = useRuntimeConfig()

  if (!isAllowedReferer(referer, config.adminUrl)) {
    reportError(new Error(`[tel-redirect] forbidden referer: ${referer?.slice(0, 128)}`))
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const digits = raw.replace(/\D/g, '')

  if (digits.length < 10 || digits.length > 15) {
    reportError(new Error(`[tel-redirect] phone length out of range: ${digits.length}`))
    throw createError({ statusCode: 400, message: 'Invalid phone length' })
  }

  return sendRedirect(event, `tel:+${digits}`, 302)
})
