import { createClient } from 'npm:@supabase/supabase-js@2'

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
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { tenantId } = await req.json() as { tenantId: string }
  if (!tenantId) {
    return new Response(JSON.stringify({ error: 'tenantId is required' }), { status: 400 })
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Проверяем что запрашивающий — участник тенанта
  const { data: membership } = await adminSupabase
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return new Response(JSON.stringify({ error: 'Not a member' }), { status: 403 })
  }

  // Загружаем мемберов
  const { data: members } = await adminSupabase
    .from('tenant_members')
    .select('id, tenant_id, user_id, role, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at')

  // Обогащаем данными из auth.users через admin API
  const { data: { users } } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
  const usersMap = new Map(users.map(u => [u.id, u]))

  const enrichedMembers = (members ?? []).map(m => {
    const authUser = usersMap.get(m.user_id)
    return {
      id: m.id,
      tenantId: m.tenant_id,
      userId: m.user_id,
      role: m.role,
      createdAt: m.created_at,
      email: authUser?.email ?? null,
      displayName: authUser?.user_metadata?.display_name ?? authUser?.email ?? null,
    }
  })

  // Загружаем pending-инвайты (только для admin+)
  let invitations: unknown[] = []
  if (['owner', 'admin'].includes(membership.role)) {
    const { data } = await adminSupabase
      .from('tenant_invitations')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })

    invitations = (data ?? []).map(inv => ({
      id: inv.id,
      tenantId: inv.tenant_id,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.invited_by,
      token: inv.token,
      expiresAt: inv.expires_at,
      acceptedAt: inv.accepted_at,
      createdAt: inv.created_at,
    }))
  }

  return new Response(JSON.stringify({ members: enrichedMembers, invitations }), { status: 200 })
})
