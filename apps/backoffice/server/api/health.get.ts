import { defineEventHandler, setResponseStatus } from 'h3'
import { getAdminClient } from '../utils/adminClient'

// Coolify/Traefik liveness-probe бьёт сюда. ВАЖНО: при degraded DB вернуть 503
// (а не 200 со status:'degraded'), иначе оркестратор не снимет инстанс с балансера
// и продолжит лить туда трафик. Тело ответа намеренно скудное — публичный endpoint
// (middleware skip'ает /api/health), внутренние детали БД наружу не отдаём.
// reportError здесь нет — у backoffice не подключён Sentry-хелпер, ограничиваемся
// console.error, чтобы инцидент был виден хотя бы в Coolify logs.
export default defineEventHandler(async (event) => {
  const supabase = getAdminClient()

  const start = Date.now()
  const { error } = await supabase.from('tenants').select('id').limit(1)
  const latencyMs = Date.now() - start

  if (error) {
    console.error('[health] DB check failed:', error.message)
    setResponseStatus(event, 503)

    return {
      status: 'degraded',
      timestamp: new Date().toISOString(),
      db: { connected: false, latencyMs },
      error: 'DB unavailable',
    }
  }

  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    db: { connected: true, latencyMs },
  }
})
