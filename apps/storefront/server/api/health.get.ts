import { defineEventHandler, setResponseStatus } from 'h3'
import { getServerSupabase } from '../utils/supabase'
import { reportError } from '~/shared/utils/reportError'

// Coolify/Traefik liveness-probe бьёт сюда. ВАЖНО: при degraded DB вернуть 503
// (а не 200 со status:'degraded'), иначе оркестратор не снимет инстанс с балансера
// и продолжит лить туда трафик. Тело ответа намеренно скудное — публичный endpoint,
// внутренние детали БД (имя таблицы, SQL) наружу не отдаём.
export default defineEventHandler(async (event) => {
  const supabase = getServerSupabase()

  const start = Date.now()
  const { error } = await supabase.from('tenants').select('id').limit(1)
  const latencyMs = Date.now() - start

  if (error) {
    reportError(error)
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
