import { defineEventHandler, getRouterParam, sendRedirect, createError } from 'h3'
import { reportError } from '~/shared/utils/reportError'

const PHONE_FORMAT = /^\+?\d+$/

export default defineEventHandler((event) => {
  const raw = getRouterParam(event, 'phone') ?? ''

  if (!PHONE_FORMAT.test(raw)) {
    reportError(new Error(`[tel-redirect] invalid phone format: ${raw.slice(0, 32)}`))
    throw createError({ statusCode: 400, message: 'Invalid phone format' })
  }

  const digits = raw.replace(/\D/g, '')

  if (digits.length < 10 || digits.length > 15) {
    reportError(new Error(`[tel-redirect] phone length out of range: ${digits.length}`))
    throw createError({ statusCode: 400, message: 'Invalid phone length' })
  }

  return sendRedirect(event, `tel:+${digits}`, 302)
})
