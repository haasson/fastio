import { reportError } from '@fastio/shared/observability'
import { DEFAULT_TABLE_SETTINGS } from '@fastio/shared'
import { getTenantDb } from '../../../utils/tenantDb'

/**
 * Конфиг кнопки вызова официанта для витрины: типы вызова + текст/иконка кнопки
 * (из table_settings). Возвращает types=[] если тенант не настроил ни одного типа
 * (UI покажет одиночную кнопку), и дефолтные label/icon если нет строки настроек.
 *
 * IDOR guard как и в check.get.ts: гость должен иметь cookie от QR-сканирования.
 */
export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const tableId = getRouterParam(event, 'id')
  if (!tableId) throw createError({ statusCode: 400 })

  if (getCookie(event, 'fastio_table') !== tableId) {
    throw createError({ statusCode: 403, message: 'Сначала отсканируйте QR-код стола' })
  }

  const [typesRes, settingsRes] = await Promise.all([
    db
      .from('table_call_types')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true }),
    db
      .from('table_settings')
      .select('call_button_label, call_button_icon')
      .maybeSingle(),
  ])

  if (typesRes.error) {
    reportError(typesRes.error)
    throw createError({ statusCode: 500, message: 'Не удалось загрузить типы вызова' })
  }
  if (settingsRes.error) {
    reportError(settingsRes.error)
    throw createError({ statusCode: 500, message: 'Не удалось загрузить настройки вызова' })
  }

  return {
    types: (typesRes.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
    })),
    callButtonLabel: (settingsRes.data?.call_button_label as string | null) ?? DEFAULT_TABLE_SETTINGS.callButtonLabel,
    callButtonIcon: (settingsRes.data?.call_button_icon as string | null) ?? DEFAULT_TABLE_SETTINGS.callButtonIcon,
  }
})
