import { getTenantDb } from '../../utils/tenantDb'

// Сколько живёт cookie `fastio_table`. Гость может сидеть за столом часами,
// но 24h — разумный потолок: следующий день QR могут отсканить другие гости,
// а старый сессионный cookie не должен открывать /check у нового стола.
const TABLE_COOKIE_TTL_SECONDS = 24 * 60 * 60

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
  if (getCookie(event, 'fastio_table') !== tableId) {
    setCookie(event, 'fastio_table', tableId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: !import.meta.dev,
      path: '/',
      maxAge: TABLE_COOKIE_TTL_SECONDS,
    })
  }

  return { id: data.id, name: data.name }
})
