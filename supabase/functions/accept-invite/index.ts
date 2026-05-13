import { createClient } from 'npm:@supabase/supabase-js@2'
const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await userSupabase.auth.getUser()
  if (authError || !user || !user.email) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: { token?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = body.token
  if (!token || typeof token !== 'string') {
    return json({ error: 'token is required' }, { status: 400 })
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Atomic: SELECT FOR UPDATE → проверки → INSERT membership → UPDATE accepted_at.
  // Все условия (expired/email mismatch/already accepted) проверяются в RPC и
  // транслируются через известные SQLSTATE. См. миграцию 269.
  const { data, error } = await adminSupabase.rpc('accept_invitation_atomic', {
    _token: token,
    _user_id: user.id,
    _user_email: user.email,
  })

  if (error) {
    // SQLSTATE-коды заданы в миграции 269 через RAISE ... USING ERRCODE.
    // Матчим по error.code (стабильно) с fallback на error.message (на случай
    // если PostgREST поменяет формат пробрасывания custom-кодов).
    switch (error.code) {
      case '23505': // unique_violation на tenant_members
        return json({ error: 'Already a member' }, { status: 409 })
      case '02000': // invitation_not_found
        return json({ error: 'Invitation not found' }, { status: 404 })
      case '23514': // invitation_already_accepted
        return json({ error: 'Invitation already accepted' }, { status: 409 })
      case '22023': // invitation_expired
        return json({ error: 'Invitation expired' }, { status: 410 })
      case '42501': // invitation_email_mismatch
        return json({ error: 'Email mismatch' }, { status: 403 })
    }

    console.error('accept_invitation_atomic error:', error)
    return json({ error: 'Failed to accept invitation' }, { status: 500 })
  }

  // RPC возвращает TABLE → всегда массив.
  const row = data?.[0]
  if (!row) {
    return json({ error: 'Unexpected empty response' }, { status: 500 })
  }

  return json({
    success: true,
    tenantId: row.tenant_id,
    roleId: row.role_id,
  }, { status: 200 })
})
