import { getTenantDb } from '../../utils/tenantDb'
import { isSecureRequest } from '../../utils/isSecureRequest'
import { reportError } from '~/shared/utils/reportError'

// PREPROD-263: сократили TTL cookie `fastio_table` с 24h до 6h — середина
// рабочей смены. Гость может сидеть за столом часами, но 6h — разумный потолок:
// в течение одной смены QR сканируют новые гости, а старый cookie не должен
// открывать /check у нового стола или ловиться на mismatch при пересадке.
const TABLE_COOKIE_TTL_SECONDS = 6 * 60 * 60

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

  // IDOR guard для /api/table/[id]/check: «принадлежность» гостя столу = наличие
  // session cookie, выданной при легитимном GET (QR-сканирование). Без cookie
  // нельзя прочитать общий чек чужого стола, даже зная UUID.
  // Не выставляем Set-Cookie если значение уже совпадает — лишний header на каждый
  // poll-запрос меню/чека не нужен.
  const existingCookie = getCookie(event, 'fastio_table')

  if (existingCookie !== tableId) {
    // PREPROD-263: фиксируем аномалию пересадки гостя — старая cookie указывает
    // на другой стол того же тенанта. Это не блокер: cookie перезаписывается
    // ниже, юзер продолжает работу. Но факт mismatch'а полезен в Sentry для
    // понимания паттернов (закрытие стола админом, второй QR-скан в смене).
    if (existingCookie) {
      reportError(new Error('table cookie session mismatch'), {
        context: 'table.get:session-mismatch',
        oldTableId: existingCookie,
        newTableId: tableId,
        tenantId: db.tenantId,
      })
    }

    setCookie(event, 'fastio_table', tableId, {
      httpOnly: true,
      sameSite: 'lax',
      // xfp-aware: за Traefik socket всегда non-encrypted, поэтому жёсткий
      // `!import.meta.dev` ставил Secure поверх http и cookie дропался браузером.
      secure: isSecureRequest(event),
      path: '/',
      maxAge: TABLE_COOKIE_TTL_SECONDS,
    })
  }

  return { id: data.id, name: data.name }
})
