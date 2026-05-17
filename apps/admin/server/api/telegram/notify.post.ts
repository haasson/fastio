import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { formatPhone } from '@fastio/shared'
import { getServerSupabase } from '../../utils/supabase'
import { requireInternalSecret } from '../../utils/auth'
import { broadcastToTenantTelegram } from '../../utils/telegramBroadcast'

type OrderItem = {
  dish_name: string
  quantity: number
  price: number
  sort_order: number
  modifiers: { groupName: string; optionName: string; priceDelta: number }[]
  addons: { name: string; price: number; quantity: number }[]
  removed_ingredients: string[]
}

export default defineEventHandler(async (event) => {
  requireInternalSecret(event)

  const { orderId, tenantId } = await readBody(event)

  if (!orderId || !tenantId) return { ok: true }

  const config = useRuntimeConfig()
  const token = config.telegramTenantBotToken?.trim()
  const adminUrl = config.adminUrl?.trim()

  if (!token) return { ok: true }

  const supabase = getServerSupabase()

  const { data: order } = await supabase
    .from('orders')
    .select('order_number, total, delivery_fee, delivery_type, address, customer_phone, customer_name, table_name, comment, order_items(dish_name, quantity, price, sort_order, modifiers, addons, removed_ingredients)')
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .single()

  if (!order) return { ok: true }

  const deliveryLabel = order.delivery_type === 'delivery'
    ? '🚗 Доставка'
    : order.delivery_type === 'pickup'
      ? '🏃 Самовывоз'
      : order.table_name ? `🪑 Стол ${order.table_name}` : '🪑 В зале'

  const phone = order.customer_phone ? formatPhone(order.customer_phone) : null

  const items = [...((order.order_items ?? []) as unknown as OrderItem[])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((i) => {
      const itemTotal = (i.price
        + (i.modifiers?.reduce((s, m) => s + m.priceDelta, 0) ?? 0)
        + (i.addons?.reduce((s, a) => s + a.price * a.quantity, 0) ?? 0)
      ) * i.quantity

      let line = `• <b>${i.dish_name}</b> × ${i.quantity} — ${itemTotal} ₽`

      if (i.modifiers?.length) {
        line += `\n  <i>${i.modifiers.map((m) => m.optionName).join(', ')}</i>`
      }
      if (i.addons?.length) {
        line += `\n  + ${i.addons.map((a) => `${a.name}${a.quantity > 1 ? ` × ${a.quantity}` : ''}`).join(', ')}`
      }
      if (i.removed_ingredients?.length) {
        line += `\n  − ${i.removed_ingredients.join(', ')}`
      }

      return line
    })
    .join('\n')

  const sep = '──────────'

  let text = `🆕 <b>Заказ${order.order_number ? ` #${order.order_number}` : ''}</b> · ${deliveryLabel}\n`

  if (order.customer_name) text += `👤 ${order.customer_name}\n`
  if (phone) text += `📞 ${phone}\n`
  if (order.address) text += `📍 ${order.address}\n`
  if (order.comment) text += `💬 ${order.comment}\n`

  text += `\n${sep}\n${items}\n${sep}\n\n`

  if (order.delivery_fee) text += `🚗 Доставка: ${order.delivery_fee} ₽\n`
  text += `💰 Итого: <b>${order.total} ₽</b>`

  const phoneDigits = order.customer_phone?.replace(/\D/g, '') ?? null
  const replyMarkup = (phoneDigits && adminUrl)
    ? {
        inline_keyboard: [[{ text: '📞 Позвонить', url: `${adminUrl}/api/tel/${phoneDigits}` }]],
      }
    : null

  await broadcastToTenantTelegram(supabase, token, tenantId, () => ({
    text,
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  }), 'telegram notify')

  return { ok: true }
})
