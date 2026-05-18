import { defineEventHandler, getHeader, setHeader, createError } from 'h3'
import { timingSafeEqual } from 'node:crypto'
import { useRuntimeConfig } from '#imports'

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  if (bufA.length !== bufB.length) return false

  return timingSafeEqual(bufA, bufB)
}

export default defineEventHandler((event) => {
  if (event.path === '/api/health') return

  const config = useRuntimeConfig()
  const expectedUser = config.backofficeUser
  const expectedPass = config.backofficePass

  if (!expectedUser || !expectedPass) {
    // Fail-closed: без env-credentials backoffice (с service_role доступом ко всей БД)
    // не должен пускать никого. До этого был return → endpoint открыт публично, если
    // env потеряли в проде (опечатка в Coolify, ребуилд без переноса secrets и т.п.).
    console.error('[auth] NUXT_BACKOFFICE_USER/PASS not configured — refusing all requests')
    throw createError({ statusCode: 500, statusMessage: 'Backoffice auth not configured' })
  }

  const auth = getHeader(event, 'authorization')
  const unauthorized = () => {
    setHeader(event, 'WWW-Authenticate', 'Basic realm="Backoffice"')
    throw createError({ statusCode: 401, message: 'Authentication required' })
  }

  if (!auth?.startsWith('Basic ')) return unauthorized()

  const decoded = Buffer.from(auth.slice(6), 'base64').toString()
  const sep = decoded.indexOf(':')

  if (sep < 0) return unauthorized()
  const user = decoded.slice(0, sep)
  const pass = decoded.slice(sep + 1)

  if (!safeEqual(user, expectedUser) || !safeEqual(pass, expectedPass)) {
    return unauthorized()
  }
})
