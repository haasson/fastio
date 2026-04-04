import { defineEventHandler, getRouterParam, sendRedirect } from 'h3'

export default defineEventHandler((event) => {
  const phone = getRouterParam(event, 'phone') ?? ''
  const digits = phone.replace(/\D/g, '')

  return sendRedirect(event, `tel:+${digits}`, 302)
})
