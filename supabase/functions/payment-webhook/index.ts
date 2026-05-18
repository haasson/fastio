import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../_shared/sentry.ts'
import { verifyYookassaHmac } from './lib.ts'

// HTTP-эндпоинт для вебхука от ЮKassa
// URL функции вставить в личный кабинет ЮKassa → Настройки → HTTP-уведомления
//
// Требуемые secrets в Supabase Dashboard → Edge Functions → Secrets:
//   YOOKASSA_WEBHOOK_SECRET — секретный ключ, заданный при создании webhook в ЮKassa
//
// ЮKassa подписывает тело запроса алгоритмом HMAC-SHA256 и передаёт подпись
// в заголовке Content-Signature в формате: v1=<hex_hmac>

Deno.serve(withSentry('payment-webhook', async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // ── 0. Kill-switch ────────────────────────────────────────────────────
  // Интеграция с онлайн-оплатой (ЮKassa) пока не запущена в проде. До тех пор,
  // пока флаг YOOKASSA_INTEGRATION_ENABLED='true' не выставлен явно, webhook
  // отвечает 410 Gone и НИЧЕГО НЕ ДЕЛАЕТ с подпиской/балансом — даже если кто-то
  // нашёл URL и шлёт валидные с виду события. 410, а не 503, чтобы ЮKassa не
  // ретраила доставку по 24ч экспоненциально (5xx триггерят повторы).
  //
  // Полная валидация webhook'а (status === 'succeeded', сверка amount/currency
  // с планом, idempotent атомарное обновление через RPC, IP-whitelist YooKassa,
  // запись в billing_transactions с type='external_payment') откладывается до
  // момента подключения онлайн-оплаты — см. LATER.md → "PREPROD-001 deferred".
  if (Deno.env.get('YOOKASSA_INTEGRATION_ENABLED') !== 'true') {
    return new Response('Payment integration disabled', { status: 410 })
  }

  // ── 1. Верификация подписи ЮKassa ──────────────────────────────────────
  const secretKey = Deno.env.get('YOOKASSA_WEBHOOK_SECRET')
  if (!secretKey) {
    console.error('YOOKASSA_WEBHOOK_SECRET is not configured')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const signature = req.headers.get('Content-Signature')
  if (!signature) {
    return new Response('Missing Content-Signature header', { status: 401 })
  }

  // Читаем тело как текст — req.json() уже нельзя будет вызвать после этого
  const body = await req.text()

  const hmac = await verifyYookassaHmac(body, signature, secretKey)
  if (!hmac.ok) {
    console.warn(`Invalid webhook signature: ${hmac.reason}`)
    if (hmac.reason === 'invalid_format') {
      return new Response('Invalid signature format', { status: 401 })
    }
    return new Response('Invalid signature', { status: 401 })
  }

  // ── 2. Парсинг события ─────────────────────────────────────────────────
  let event: Record<string, unknown>
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  if (event.event !== 'payment.succeeded') {
    return new Response('ok', { status: 200 })
  }

  const payment = event.object as Record<string, unknown>
  const paymentId = payment.id as string | undefined
  const tenantId = (payment.metadata as Record<string, string> | undefined)?.tenantId

  if (!tenantId) {
    return new Response('Missing tenantId in metadata', { status: 400 })
  }

  if (!paymentId) {
    return new Response('Missing payment id', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── 3. Идемпотентность — не обрабатывать один платёж дважды ───────────
  const { data: existing } = await supabase
    .from('processed_webhook_events')
    .select('id')
    .eq('event_id', paymentId)
    .maybeSingle()

  if (existing) {
    // Уже обработали этот payment.succeeded — возвращаем 200 как идемпотентный ответ
    return new Response('ok', { status: 200 })
  }

  // Записываем событие до обновления подписки, чтобы при падении не задублировать
  const { error: insertError } = await supabase
    .from('processed_webhook_events')
    .insert({ event_id: paymentId, payload: event })

  if (insertError) {
    // Гонка: другой запрос успел вставить раньше — просто выходим
    if (insertError.code === '23505') {
      return new Response('ok', { status: 200 })
    }
    console.error('Failed to record webhook event:', insertError)
    return new Response('Internal error', { status: 500 })
  }

  // ── 4. Основная логика: продление подписки ─────────────────────────────
  const { data: tenant } = await supabase
    .from('tenants')
    .select('subscription')
    .eq('id', tenantId)
    .single()

  if (!tenant) {
    return new Response('Tenant not found', { status: 404 })
  }

  const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  await supabase
    .from('tenants')
    .update({
      subscription: {
        ...tenant.subscription,
        status: 'active',
        renewsAt,
      },
    })
    .eq('id', tenantId)

  return new Response('ok', { status: 200 })
}))
