import { createClient } from 'npm:@supabase/supabase-js@2'
import { withSentry } from '../_shared/sentry.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Триггер: Database Webhook на INSERT в таблице orders.
//
// Настройка в Supabase Dashboard → Database → Webhooks:
//   1. Создать webhook на orders INSERT с URL этой функции
//   2. В HTTP Headers добавить:  x-fastio-webhook-secret: <значение FASTIO_WEBHOOK_SECRET>
//   3. Тот же секрет задать функции:  supabase secrets set FASTIO_WEBHOOK_SECRET=<random32>
//
// Без секрета функция возвращает 401: webhook URL утекает в edge-logs / Dashboard,
// и без верификации заголовка любой POST мог бы триггерить отправку поддельных писем
// тенантам (PII утечка + SMTP reputation damage).
const WEBHOOK_SECRET = Deno.env.get('FASTIO_WEBHOOK_SECRET')

Deno.serve(withSentry('send-order-email', async (req) => {
  if (!WEBHOOK_SECRET) {
    console.error('FASTIO_WEBHOOK_SECRET is not configured')
    return new Response('Server misconfigured', { status: 500 })
  }
  if (req.headers.get('x-fastio-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await req.json()

  if (payload.type !== 'INSERT') {
    return new Response('ok', { status: 200 })
  }

  const order = payload.record
  const tenantId = order.tenant_id

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('dish_name, quantity, price')
    .eq('order_id', order.id)
    .order('sort_order')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('notifications, name')
    .eq('id', tenantId)
    .single()

  if (!tenant?.notifications?.email) {
    return new Response('No email configured', { status: 200 })
  }

  const itemsList = (orderItems ?? [])
    .map((item: { dish_name: string; quantity: number; price: number }) =>
      `${item.dish_name} x${item.quantity} — ${Number(item.price) * item.quantity} ₽`)
    .join('\n')

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('SENDGRID_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: [{ email: tenant.notifications.email }],
      from: { email: 'noreply@fastio.ru' },
      subject: `Новый заказ #${order.order_number ?? order.id}`,
      content: [{
        type: 'text/plain',
        value: [
          `Заказ от: ${order.customer_name} (${order.customer_phone})`,
          `Тип: ${order.delivery_type === 'delivery' ? 'Доставка' : 'Самовывоз'}`,
          order.address ? `Адрес: ${order.address}` : '',
          '',
          'Состав:',
          itemsList,
          '',
          `Итого: ${order.total} ₽`,
          order.comment ? `Комментарий: ${order.comment}` : '',
        ].filter(Boolean).join('\n'),
      }],
    }),
  })

  if (!response.ok) {
    console.error('SendGrid error:', await response.text())
    return new Response('Email failed', { status: 500 })
  }

  return new Response('ok', { status: 200 })
}))
