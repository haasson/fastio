import { defineEventHandler, getHeader, setHeader, createError } from 'h3'
import { useRuntimeConfig } from '#imports'

let authWarned = false

export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/') || event.path === '/api/health') return

  const config = useRuntimeConfig()
  const expectedUser = config.backofficeUser
  const expectedPass = config.backofficePass

  // Skip if no credentials configured (local dev without env vars)
  if (!expectedUser || !expectedPass) {
    if (!authWarned) {
      console.warn('[auth] NUXT_BACKOFFICE_USER/PASS not set — auth disabled')
      authWarned = true
    }

    return
  }

  const auth = getHeader(event, 'authorization')

  if (!auth?.startsWith('Basic ')) {
    setHeader(event, 'WWW-Authenticate', 'Basic realm="Backoffice"')
    throw createError({ statusCode: 401, message: 'Authentication required' })
  }

  const decoded = Buffer.from(auth.slice(6), 'base64').toString()
  const [user, pass] = decoded.split(':')

  if (user !== expectedUser || pass !== expectedPass) {
    setHeader(event, 'WWW-Authenticate', 'Basic realm="Backoffice"')
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }
})
