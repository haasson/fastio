import { defineEventHandler, setResponseStatus } from 'h3'
import { getServerSupabase } from '../utils/supabase'
import { reportError } from '~/shared/utils/reportError'

// Coolify/Traefik liveness-probe бьёт сюда. ВАЖНО: при degraded DB вернуть 503
// (а не 200 со status:'degraded'), иначе оркестратор не снимет инстанс с балансера
// и продолжит лить туда трафик. Тело ответа минимальное (PREPROD-208) —
// публичный endpoint, никаких внутренних деталей (имя таблицы, SQL, latency,
// timestamp) наружу не отдаём. Probe смотрит только на HTTP status.
export default defineEventHandler(async (event) => {
  // Весь handler в try — getServerSupabase() / runtimeConfig могут бросить ДО
  // try внутри, и без обёртки в дефолтный h3-error-handler выпадет 500 вместо
  // 503. Liveness-probe в этом случае не отличит «приложение целое, БД лежит»
  // от «приложение упало совсем».
  try {
    const supabase = getServerSupabase()
    // Если переименуем таблицу `tenants` — этот probe тоже даст 503 (false
    // positive). Намеренно: tenants — core-таблица, её переименование = миграция
    // про которую и так все должны знать. Не маскируем «забыли обновить probe».
    const { error } = await supabase.from('tenants').select('id').limit(1)

    if (error) {
      reportError(error)
      setResponseStatus(event, 503)

      return { ok: false, db: 'disconnected' }
    }

    return { ok: true, db: 'connected' }
  } catch (e) {
    reportError(e)
    setResponseStatus(event, 503)

    return { ok: false, db: 'disconnected' }
  }
})
