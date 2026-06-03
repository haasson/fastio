import { getTenantDb } from '../../utils/tenantDb'
import { reportError } from '@fastio/shared/observability'
import { DEFAULT_TABLE_SETTINGS } from '@fastio/shared'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const tableId = getRouterParam(event, 'id')
  if (!tableId) throw createError({ statusCode: 400, message: 'Table ID required' })

  const { data, error } = await db
    .from('tables')
    .select('id, name, is_open, is_active')
    .eq('id', tableId)
    .single()

  if (error || !data) {
    throw createError({ statusCode: 404, message: 'Стол не найден' })
  }

  if (!data.is_active) {
    throw createError({ statusCode: 404, message: 'Стол не найден' })
  }

  if (!data.is_open) {
    throw createError({ statusCode: 400, message: 'Стол сейчас не обслуживается' })
  }

  // Проверяем что dineIn модуль включён
  const { data: tenant } = await db
    .from('tenants')
    .select('modules')
    .single()

  if (!tenant?.modules?.dineIn) {
    throw createError({ statusCode: 400, message: 'Заказ со стола недоступен' })
  }

  // Тогглы режима стола (table_settings): заказ со стола / вызов официанта —
  // каждый опционален. Отдаём клиенту, чтобы витрина-стол гейтила UI (read-only
  // showcase / call-only / ordering-only / both). DEFAULT true сохраняет текущее
  // поведение тенанта без строки настроек. Чтение через service-role (getTenantDb).
  const { data: settings, error: settingsError } = await db
    .from('table_settings')
    .select('dine_in_ordering_enabled, waiter_call_enabled')
    .maybeSingle()

  if (settingsError) {
    reportError(settingsError)
    throw createError({ statusCode: 500, message: 'Не удалось загрузить настройки стола' })
  }

  const dineInOrderingEnabled = settings?.dine_in_ordering_enabled ?? DEFAULT_TABLE_SETTINGS.dineInOrderingEnabled
  const waiterCallEnabled = settings?.waiter_call_enabled ?? DEFAULT_TABLE_SETTINGS.waiterCallEnabled

  // IDOR guard для /api/table/[id]/check|call: «принадлежность» гостя столу =
  // наличие cookie `fastio_table`. Сама cookie выставляется СТРАНИЦЕЙ
  // `pages/table/[id]/index.vue` через `useCookie` (SSR-aware, долетает до браузера
  // и на свежем заходе, и на client-nav). Здесь Set-Cookie НЕ ставим: setCookie
  // внутри этого хендлера на SSR живёт во вложенном rfetch-под-запросе и до браузера
  // не доходит (Nuxt-готча) — единственный источник истины теперь страница.
  // Этот блок оставляем только ради телеметрии пересадки гостя.
  const existingCookie = getCookie(event, 'fastio_table')

  if (existingCookie && existingCookie !== tableId) {
    // PREPROD-263: аномалия пересадки — старая cookie указывает на другой стол
    // того же тенанта. Не блокер (страница перезапишет cookie на новый tableId),
    // но факт mismatch'а полезен в Sentry (закрытие стола админом, второй QR-скан).
    reportError(new Error('table cookie session mismatch'), {
      context: 'table.get:session-mismatch',
      oldTableId: existingCookie,
      newTableId: tableId,
      tenantId: db.tenantId,
    })
  }

  return { id: data.id, name: data.name, dineInOrderingEnabled, waiterCallEnabled }
})
