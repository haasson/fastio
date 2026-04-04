import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getServerSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const { orderId, tenantId } = await readBody(event)

  if (!orderId || !tenantId) return { ok: true }

  const config = useRuntimeConfig()
  const token = config.telegramBotToken

  if (!token) return { ok: true }

  const supabase = getServerSupabase()

  const [{ data: tenant }, { data: order }] = await Promise.all([
    supabase.from('tenants').select('notifications').eq('id', tenantId).single(),
    supabase
      .from('orders')
      .select('order_number, total, delivery_type, address, customer_phone, table_name, order_items(dish_name, quantity, sort_order)')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single(),
  ])

  const chatId = tenant?.notifications?.telegramChatId
  const threadId = tenant?.notifications?.telegramThreadId ?? null

  if (!chatId || !order) return { ok: true }

  const deliveryLabel = order.delivery_type === 'delivery'
    ? 'Доставка'
    : order.delivery_type === 'pickup'
      ? 'Самовывоз'
      : order.table_name ? `В зале (${order.table_name})` : 'В зале'

  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  const items = [...(order.order_items ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((i) => `• ${i.dish_name} × ${i.quantity}`)
    .join('\n')

  let text = `🆕 <b>Новый заказ${order.order_number ? ` #${order.order_number}` : ''}</b>\n\n`

  text += `💰 ${order.total} ₽ · ${deliveryLabel}\n`
  if (order.address) text += `📍 ${order.address}\n`
  if (order.customer_phone) text += `📞 ${order.customer_phone}\n`
  text += `🕐 ${time}\n\n`
  text += items

  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' }

  if (threadId) payload.message_thread_id = threadId

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  return { ok: true }
})
