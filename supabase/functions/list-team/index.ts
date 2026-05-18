import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../_shared/sentry.ts'
const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { ...init, headers: { 'Content-Type': 'application/json' } })

Deno.serve(withSentry('list-team', async (req) => {
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
    return json({ error: 'tenantId is required' }, { status: 400 })
  }

  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Проверяем что запрашивающий — участник тенанта
  const { data: membership } = await adminSupabase
    .from('tenant_members')
    .select('role_id, tenant_roles(permissions)')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return json({ error: 'Not a member' }, { status: 403 })
  }

  const isOwner = membership.role_id === null
  const permissions = (membership as { tenant_roles?: { permissions?: Record<string, boolean> } }).tenant_roles?.permissions

  // Загружаем мемберов с ролями
  const { data: members } = await adminSupabase
    .from('tenant_members')
    .select('id, tenant_id, user_id, role_id, branch_ids, blocked_until, created_at, tenant_roles(id, name, permissions)')
    .eq('tenant_id', tenantId)
    .order('created_at')

  const memberUserIds = (members ?? []).map(m => m.user_id)

  // Загружаем принятые инвайты для отображения "кто пригласил"
  const { data: acceptedInvites } = await adminSupabase
    .from('tenant_invitations')
    .select('email, invited_by')
    .eq('tenant_id', tenantId)
    .not('accepted_at', 'is', null)

  // email участника → user_id пригласившего
  const invitedByMap = new Map(
    (acceptedInvites ?? []).map(inv => [inv.email, inv.invited_by])
  )

  const inviterUserIds = [...new Set(
    (acceptedInvites ?? []).map(inv => inv.invited_by).filter(Boolean)
  )]

  // Получаем профили участников и пригласивших через DB (SECURITY DEFINER).
  // Вызываем от имени пользователя (userSupabase), потому что функция опирается
  // на auth.uid(). Используем tenant-scoped вариант, чтобы исключить утечку
  // профилей мемберов чужого тенанта в multi-tenant сценарии.
  const allUserIds = [...new Set([...memberUserIds, ...inviterUserIds])]
  const { data: profileRows } = await userSupabase
    .rpc('get_user_profiles_for_tenant', { p_tenant_id: tenantId, user_ids: allUserIds })

  type UserProfile = { user_id: string; email: string; full_name: string | null }
  const profileMap = new Map<string, UserProfile>(
    (profileRows ?? []).map((u: UserProfile) => [u.user_id, u])
  )

  const getDisplayName = (userId: string) => {
    const p = profileMap.get(userId)
    return p?.full_name ?? p?.email ?? null
  }

  const enrichedMembers = (members ?? []).map(m => {
    const profile = profileMap.get(m.user_id)
    const email = profile?.email ?? null
    const invitedByUserId = email ? invitedByMap.get(email) : null
    const invitedBy = invitedByUserId ? getDisplayName(invitedByUserId) : null
    const roleData = (m as unknown as { tenant_roles?: { id: string; name: string; permissions: Record<string, boolean> } | null }).tenant_roles

    return {
      id: m.id,
      tenantId: m.tenant_id,
      userId: m.user_id,
      roleId: m.role_id ?? null,
      roleName: roleData?.name ?? null,
      permissions: roleData?.permissions ?? {},
      branchIds: m.branch_ids ?? [],
      blockedUntil: m.blocked_until ?? null,
      createdAt: m.created_at,
      email,
      displayName: getDisplayName(m.user_id),
      invitedBy,
    }
  })

  // Загружаем pending-инвайты (только для тех кто имеет team.manage).
  // Поле `token` намеренно НЕ выбирается из БД и НЕ возвращается клиенту:
  // любой member с team.manage увидел бы live-токены в Network tab/Sentry —
  // их хватит чтобы активировать чужой инвайт. Если когда-нибудь понадобится
  // фича «копировать ссылку» — делать отдельным endpoint'ом с rate-limit + audit.
  // KEEP IN SYNC: тот же набор колонок в apps/admin/utils/api/invitations.ts
  // (INVITATION_COLUMNS) — правки делать в обоих местах.
  let invitations: unknown[] = []
  if (isOwner || permissions?.['team.manage']) {
    const { data } = await adminSupabase
      .from('tenant_invitations')
      .select('id, tenant_id, email, role_id, invited_by, expires_at, accepted_at, created_at, branch_ids, tenant_roles(id, name)')
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })

    invitations = (data ?? []).map(inv => {
      const invRoleData = (inv as unknown as { tenant_roles?: { id: string; name: string } | null }).tenant_roles

      return {
        id: inv.id,
        tenantId: inv.tenant_id,
        email: inv.email,
        roleId: inv.role_id ?? null,
        roleName: invRoleData?.name ?? null,
        invitedBy: inv.invited_by,
        expiresAt: inv.expires_at,
        acceptedAt: inv.accepted_at,
        createdAt: inv.created_at,
        branchIds: inv.branch_ids ?? [],
      }
    })
  }

  return json({ members: enrichedMembers, invitations }, { status: 200 })
}))
