import { createClient } from 'npm:@supabase/supabase-js@2'

// Callable-замена: вызывается из админки когда владелец вводит свой домен
// Клиент должен передавать Authorization: Bearer <supabase_access_token>
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Верифицируем JWT через anon-клиент с токеном пользователя
  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await userSupabase.auth.getUser()
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { domain } = await req.json() as { domain: string }
  if (!domain) {
    return new Response(JSON.stringify({ error: 'domain is required' }), { status: 400 })
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: tenant } = await adminSupabase
    .from('tenants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!tenant) {
    return new Response(JSON.stringify({ error: 'Tenant not found' }), { status: 404 })
  }

  const vercelResponse = await fetch(
    `https://api.vercel.com/v10/projects/${Deno.env.get('VERCEL_PROJECT_ID')}/domains`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('VERCEL_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    },
  )

  if (!vercelResponse.ok) {
    const err = await vercelResponse.json() as { error?: { message?: string } }
    return new Response(
      JSON.stringify({ error: err.error?.message ?? 'Vercel error' }),
      { status: 500 },
    )
  }

  await adminSupabase
    .from('tenants')
    .update({ custom_domain: domain })
    .eq('id', tenant.id)

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
