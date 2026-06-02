import { reportError } from '@fastio/shared/observability'
import { DEFAULT_TABLE_SETTINGS } from '@fastio/shared'
import { getTenantDb } from '../../../utils/tenantDb'

const DEFAULT_CALL_TYPE_NAME = 'Вызвать официанта'

// Простая uuid v1-v5 валидация — отсекаем мусор до DB-запроса, чтобы PG не
// возвращал invalid_text_representation (22P02) и не триггерил Sentry-spam.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const tableId = getRouterParam(event, 'id')
  if (!tableId || !UUID_RE.test(tableId)) {
    throw createError({ statusCode: 400, message: 'Table ID required' })
  }

  // IDOR guard: гость должен иметь cookie от GET /api/table/[id] (QR-сканирование).
  // Без cookie нельзя слать вызовы за чужой стол, даже зная UUID.
  if (getCookie(event, 'fastio_table') !== tableId) {
    throw createError({ statusCode: 403, message: 'Сначала отсканируйте QR-код стола' })
  }

  // Кулдаун берём из настроек тенанта (table_settings). Чтение через service-role
  // (getTenantDb авто-инжектит tenant_id) — RLS public_read на таблице нет.
  const { data: settings, error: settingsError } = await db
    .from('table_settings')
    .select('call_cooldown_seconds')
    .maybeSingle()
  if (settingsError) {
    reportError(settingsError)
    throw createError({ statusCode: 500, message: 'Не удалось загрузить настройки столов' })
  }
  const cooldownSeconds = settings?.call_cooldown_seconds ?? DEFAULT_TABLE_SETTINGS.callCooldownSeconds

  // Rate-limit первым делом после cookie-guard: 1 вызов в `cooldownSeconds` на стол.
  // Inline-вызов (вместо enforceRateLimit), чтобы передать клиенту retryAfter
  // и не дать ему сбиться с серверной длительностью cooldown.
  const { data: limitOk, error: limitError } = await db.crossTenant.rpc('consume_rate_limit', {
    _key: `table-call:${tableId}`,
    _max: 1,
    _window_seconds: cooldownSeconds,
  })
  if (limitError) {
    reportError(limitError)
    throw createError({ statusCode: 500, message: 'Не удалось проверить rate-limit' })
  }
  if (limitOk === false) {
    throw createError({
      statusCode: 429,
      message: `Подождите ${cooldownSeconds} секунд перед следующим вызовом`,
      data: { retryAfter: cooldownSeconds },
    })
  }

  // Стол должен быть активен и открыт (та же проверка что в RLS-политике INSERT,
  // которая с миграции 289 реально срабатывает благодаря FORCE ROW LEVEL SECURITY).
  const { data: table, error: tableError } = await db
    .from('tables')
    .select('id, is_open, is_active')
    .eq('id', tableId)
    .single()

  if (tableError) {
    reportError(tableError)
    throw createError({ statusCode: 500, message: 'Не удалось получить данные стола' })
  }
  if (!table || !table.is_active) {
    throw createError({ statusCode: 404, message: 'Стол не найден' })
  }
  if (!table.is_open) {
    throw createError({ statusCode: 400, message: 'Стол сейчас не обслуживается' })
  }

  // Опциональный тип вызова (счёт / дозаказ / помощь и т.д.). Если не передан —
  // используется generic тип «Вызвать официанта».
  const body = await readBody(event).catch(() => ({})) as { callTypeId?: unknown }
  const callTypeId = typeof body?.callTypeId === 'string' ? body.callTypeId : null
  if (callTypeId !== null && !UUID_RE.test(callTypeId)) {
    throw createError({ statusCode: 400, message: 'Неверный формат callTypeId' })
  }

  let callTypeName = DEFAULT_CALL_TYPE_NAME
  if (callTypeId) {
    const { data: callType, error: callTypeError } = await db
      .from('table_call_types')
      .select('id, name')
      .eq('id', callTypeId)
      .maybeSingle()

    if (callTypeError) {
      reportError(callTypeError)
      throw createError({ statusCode: 500, message: 'Не удалось получить тип вызова' })
    }
    if (!callType) {
      throw createError({ statusCode: 400, message: 'Неизвестный тип вызова' })
    }
    callTypeName = callType.name as string
  }

  // db.from('table_calls').insert() запрещён Proxy в tenantDb — нужен явный
  // tenant_id в payload через crossTenant (service-role). С миграции 289 на таблице
  // выставлен FORCE ROW LEVEL SECURITY, поэтому RLS-политика "table_calls: insert
  // for valid open table" реально проверяет валидный открытый стол этого тенанта.
  const { data: call, error: insertError } = await db.crossTenant
    .from('table_calls')
    .insert({
      tenant_id: db.tenantId,
      table_id: tableId,
      call_type_id: callTypeId,
      call_type_name: callTypeName,
    })
    .select('id, created_at, call_type_name')
    .single()

  if (insertError || !call) {
    reportError(insertError ?? new Error('[table/call] insert returned no data'))
    throw createError({ statusCode: 500, message: 'Не удалось создать вызов' })
  }

  return { call, cooldownSeconds }
})
