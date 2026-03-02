import { getServerSupabase } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const body = await readBody(event)

  if (!body.customer?.name || !body.customer?.phone) {
    throw createError({ statusCode: 400, message: 'Имя и телефон обязательны' })
  }
  if (!body.items?.length) {
    throw createError({ statusCode: 400, message: 'Корзина пуста' })
  }

  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      customer: body.customer,
      items: body.items,
      delivery_type: body.deliveryType,
      address: body.address ?? null,
      comment: body.comment ?? null,
      promo_code: body.promoCode ?? null,
      discount_amount: body.discountAmount ?? 0,
      subtotal: body.subtotal,
      delivery_fee: body.deliveryFee ?? 0,
      total: body.total,
      status: 'new',
      payment_type: body.paymentType ?? 'cash',
    })
    .select('id')
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  return { id: data.id }
})
