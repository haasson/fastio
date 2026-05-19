import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../_shared/sentry.ts'
const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } })

// Два режима работы:
//  1. Authenticated (есть Authorization header) — пользователь уже залогинен и
//     просто принимает invite. Использовался когда email-signup был доступен и
//     юзер мог вернуться по email-confirm-ссылке с готовой session.
//  2. Unauthenticated (нет Authorization, есть body.password+full_name) — после
//     отключения client-side signUp в GoTrue (PREPROD-099 follow-up) единственный
//     способ принять invite. Server создаёт user через admin.createUser
//     с email_confirm=true (invite-токен сам по себе подтверждает что email рабочий)
//     и принимает invite атомарно. Клиент после success делает signInWithPassword
//     с тем же email/password — получает session.
Deno.serve(withSentry('accept-invite', async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body: { token?: string; password?: string; fullName?: string }
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

  const authHeader = req.headers.get('Authorization')

  // ──────────────────────────────────────────────────────────────────────
  // Authenticated mode — пользователь уже залогинен.
  // ──────────────────────────────────────────────────────────────────────
  if (authHeader) {
    const userSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await userSupabase.auth.getUser()
    if (authError || !user || !user.email) {
      return new Response('Unauthorized', { status: 401 })
    }

    return await acceptForUser(adminSupabase, token, user.id, user.email)
  }

  // ──────────────────────────────────────────────────────────────────────
  // Unauthenticated mode — server создаёт user и принимает invite.
  // ──────────────────────────────────────────────────────────────────────
  const password = body.password
  const fullName = body.fullName
  if (!password || typeof password !== 'string' || password.length < 6) {
    return json({ error: 'password is required (≥6 chars)' }, { status: 400 })
  }
  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    return json({ error: 'fullName is required' }, { status: 400 })
  }

  // Step 1: валидируем invitation ДО createUser — чтобы не создать orphan user
  // для просроченного/использованного токена.
  const { data: invitation, error: invErr } = await adminSupabase
    .from('tenant_invitations')
    .select('email, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle()

  if (invErr) {
    console.error('invitation lookup error:', invErr)
    return json({ error: 'Failed to validate invitation' }, { status: 500 })
  }
  if (!invitation) {
    return json({ error: 'Invitation not found' }, { status: 404 })
  }
  if (invitation.accepted_at) {
    return json({ error: 'Invitation already accepted' }, { status: 409 })
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return json({ error: 'Invitation expired' }, { status: 410 })
  }

  // Step 2: createUser. email_confirm=true — invite-токен подтверждает что email
  // принадлежит этому пользователю (мы сами его на этот email отправили).
  const { data: created, error: createErr } = await adminSupabase.auth.admin.createUser({
    email: invitation.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim() },
  })

  if (createErr || !created?.user) {
    // 422 от GoTrue = email уже занят. Это легитимная ситуация: владелец уже
    // зарегистрирован в системе и его пригласили в чужой tenant. Тогда он
    // должен использовать authenticated-mode (залогиниться сначала).
    const msg = createErr?.message ?? ''
    if (msg.includes('already') || msg.includes('exists') || createErr?.status === 422) {
      return json({ error: 'Email already registered. Please log in first.', code: 'email_exists' }, { status: 409 })
    }
    console.error('createUser error:', createErr)
    return json({ error: 'Failed to create account' }, { status: 500 })
  }

  // Step 3: accept invitation атомарно. Если упадёт — cleanup orphan user.
  const result = await acceptForUser(adminSupabase, token, created.user.id, invitation.email)
  if (result.status !== 200) {
    await adminSupabase.auth.admin.deleteUser(created.user.id).catch((err: unknown) => {
      console.error('cleanup deleteUser failed:', err)
    })
  }

  return result
}))

type AdminClient = ReturnType<typeof createClient>

async function acceptForUser(
  adminSupabase: AdminClient,
  token: string,
  userId: string,
  userEmail: string,
): Promise<Response> {
  // Atomic: SELECT FOR UPDATE → проверки → INSERT membership → UPDATE accepted_at.
  // Все условия (expired/email mismatch/already accepted) проверяются в RPC и
  // транслируются через известные SQLSTATE. См. миграцию 269.
  const { data, error } = await adminSupabase.rpc('accept_invitation_atomic', {
    _token: token,
    _user_id: userId,
    _user_email: userEmail,
  })

  if (error) {
    // SQLSTATE-коды заданы в миграции 269 через RAISE ... USING ERRCODE.
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
}
