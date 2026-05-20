import { defineEventHandler, setResponseStatus } from 'h3'
import { getServerSupabase } from '../utils/supabase'
import { reportError } from '@fastio/shared/observability'

// Coolify/Traefik liveness-probe бьёт сюда. ВАЖНО: при degraded DB вернуть 503
// (а не 200 со status:'degraded'), иначе оркестратор не снимет инстанс с балансера
// и продолжит лить туда трафик. Тело ответа намеренно скудное — публичный endpoint,
// внутренние детали БД (имя таблицы, SQL) наружу не отдаём.
export default defineEventHandler(async (event) => {
  // Весь handler в try — getServerSupabase() / runtimeConfig могут бросить ДО
  // try внутри, и без обёртки в дефолтный h3-error-handler выпадет 500 вместо
  // 503. Liveness-probe в этом случае не отличит «приложение целое, БД лежит»
  // от «приложение упало совсем».
  const start = performance.now() // monotonic, не подвержено NTP-коррекциям

  try {
    const supabase = getServerSupabase()
    // Если переименуем таблицу `tenants` — этот probe тоже даст 503 (false
    // positive). Намеренно: tenants — core-таблица, её переименование = миграция
    // про которую и так все должны знать. Не маскируем «забыли обновить probe».
    const { error } = await supabase.from('tenants').select('id').limit(1)
    const latencyMs = Math.round(performance.now() - start)

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
  } catch (e) {
    reportError(e)
    setResponseStatus(event, 503)

    return {
      status: 'degraded',
      timestamp: new Date().toISOString(),
      db: { connected: false, latencyMs: Math.round(performance.now() - start) },
      error: 'Health check failed',
    }
  }
})
