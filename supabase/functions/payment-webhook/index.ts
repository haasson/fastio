import { createClient } from 'npm:@supabase/supabase-js@2'

// HTTP-эндпоинт для вебхука от ЮKassa
// URL функции вставить в личный кабинет ЮKassa → Настройки → HTTP-уведомления
// TODO: верификация подписи от ЮKassa (IP whitelist + HMAC)
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const event = await req.json()

  if (event.event !== 'payment.succeeded') {
    return new Response('ok', { status: 200 })
  }

  const payment = event.object
  const tenantId = payment.metadata?.tenantId

  if (!tenantId) {
    return new Response('Missing tenantId in metadata', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

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
})
