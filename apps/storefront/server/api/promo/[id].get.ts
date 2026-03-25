import { getServerSupabase } from '../../utils/supabase'

type PromoPageData = {
  id: string
  title: string
  content: string
  bannerUrl: string | null
  type: 'promotion' | 'promo_code'
  code?: string
}

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  const id = getRouterParam(event, 'id')

  if (!tenantId || !id) throw createError({ statusCode: 404 })

  const supabase = getServerSupabase()

  // Баннер является основной сущностью — id это id баннера
  const { data: banner } = await supabase
    .from('banners')
    .select('id, url, content, enabled, promotion_id, promo_code_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (!banner || !banner.enabled) throw createError({ statusCode: 404 })

  // Заголовок — из привязанной акции или промокода
  let title = ''
  let type: PromoPageData['type'] = 'promotion'
  let code: string | undefined

  if (banner.promotion_id) {
    const { data: promo } = await supabase
      .from('promotions')
      .select('title, active, deleted_at')
      .eq('id', banner.promotion_id)
      .single()

    if (!promo || promo.deleted_at !== null || !promo.active) throw createError({ statusCode: 404 })
    title = promo.title
    type = 'promotion'
  } else if (banner.promo_code_id) {
    const { data: promoCode } = await supabase
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
