import { getTenantDb } from '../../utils/tenantDb'

type PromoPageData = {
  id: string
  title: string
  content: string
  bannerUrl: string | null
  type: 'promotion' | 'promo_code'
  code?: string
}

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 404 })

  // Баннер является основной сущностью — id это id баннера
  const { data: banner } = await db
    .from('banners')
    .select('id, url, content, enabled, promotion_id, promo_code_id')
    .eq('id', id)
    .single()

  if (!banner || !banner.enabled) throw createError({ statusCode: 404 })

  // Заголовок — из привязанной акции или промокода
  let title = ''
  let type: PromoPageData['type'] = 'promotion'
  let code: string | undefined

  if (banner.promotion_id) {
    // safe: promotion_id came from the banner row which is already filtered by tenant_id above
    const { data: promo } = await db
      .from('promotions')
      .select('title, active, deleted_at')
      .eq('id', banner.promotion_id)
      .single()

    if (!promo || promo.deleted_at !== null || !promo.active) throw createError({ statusCode: 404 })
    title = promo.title
    type = 'promotion'
  } else if (banner.promo_code_id) {
    // safe: promo_code_id came from the banner row which is already filtered by tenant_id above
    const { data: promoCode } = await db
      .from('promo_codes')
      .select('code, active, deleted_at')
      .eq('id', banner.promo_code_id)
      .single()

    if (!promoCode || promoCode.deleted_at !== null || !promoCode.active) throw createError({ statusCode: 404 })
    title = promoCode.code
    type = 'promo_code'
    code = promoCode.code
  }

  return {
    id: banner.id,
    title,
    content: banner.content ?? '',
    bannerUrl: banner.url,
    type,
    ...(code && { code }),
  } satisfies PromoPageData
})
