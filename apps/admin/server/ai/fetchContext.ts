import { getServerSupabase } from '~/server/utils/supabase'

export type AiContext = {
  tenantName: string
  businessType: string | null
  plan: string
  modules: Record<string, boolean>
  roleName: string | null
  permissions: Record<string, boolean>
}

type TenantRow = {
  name: string | null
  business_type: string | null
  subscription: { plan?: string } | null
  modules: Record<string, boolean> | null
}

type RoleRow = { name: string; permissions: Record<string, boolean> }

type MemberRow = {
  role_id: string | null
  tenant_roles: RoleRow | RoleRow[] | null
}

export async function fetchTenantContext(
  tenantId: string,
  userId: string,
): Promise<AiContext> {
  const sb = getServerSupabase()

  const [tenantResult, memberResult] = await Promise.all([
    sb.from('tenants')
      .select('name, business_type, subscription, modules')
      .eq('id', tenantId)
      .single<TenantRow>(),
    sb.from('tenant_members')
      .select('role_id, tenant_roles(name, permissions)')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single<MemberRow>(),
  ])

  if (tenantResult.error) {
    console.error('[AI] Failed to fetch tenant:', tenantResult.error.message)
  }
  if (memberResult.error) {
    console.error('[AI] Failed to fetch member:', memberResult.error.message)
  }

  const tenant = tenantResult.data
  const member = memberResult.data

  const isOwner = !member?.role_id
  const rawRole = member?.tenant_roles ?? null
  const role: RoleRow | null = Array.isArray(rawRole) ? rawRole[0] ?? null : rawRole

  return {
    tenantName: tenant?.name ?? '',
    businessType: tenant?.business_type ?? null,
    plan: tenant?.subscription?.plan ?? 'start',
    modules: tenant?.modules ?? {},
    roleName: isOwner ? 'Владелец' : (role?.name ?? null),
    permissions: isOwner ? {} : (role?.permissions ?? {}),
  }
}

const MODULE_LABELS: Record<string, string> = {
  delivery: 'Доставка',
  pickup: 'Самовывоз',
  modifiers: 'Модификаторы',
  addons: 'Добавки',
  promotions: 'Акции и промокоды',
  combos: 'Комбо-наборы',
  kitchen: 'Кухня',
  reservations: 'Бронирование столов',
  dineIn: 'Заказ со стола',
  customRoles: 'Кастомные роли',
  customers: 'Личный кабинет клиентов',
}

export function formatContextForPrompt(ctx: AiContext): string {
  const lines: string[] = []

  lines.push(`Тенант: ${ctx.tenantName}`)

  const bizLabels: Record<string, string> = {
    food: 'Общепит (ресторан/кафе)',
    retail: 'Розничная торговля',
    services: 'Услуги',
  }

  if (ctx.businessType) {
    lines.push(`Тип бизнеса: ${bizLabels[ctx.businessType] || ctx.businessType}`)
  }

  lines.push(`Тариф: ${ctx.plan}`)

  const moduleLabel = (key: string) => MODULE_LABELS[key] || key

  const enabledModules = Object.entries(ctx.modules)
    .filter(([, v]) => v)
    .map(([k]) => moduleLabel(k))
  const disabledModules = Object.entries(ctx.modules)
    .filter(([, v]) => !v)
    .map(([k]) => moduleLabel(k))

  lines.push(`Включённые модули: ${enabledModules.join(', ') || 'нет'}`)
  lines.push(`Выключенные модули: ${disabledModules.join(', ') || 'нет'}`)

  lines.push(`Роль пользователя: ${ctx.roleName ?? 'неизвестна'}`)

  if (ctx.roleName === 'Владелец') {
    lines.push(`Пермишены: все (владелец имеет полный доступ)`)
  } else {
    const granted = Object.entries(ctx.permissions)
      .filter(([, v]) => v)
      .map(([k]) => k)

    lines.push(`Пермишены: ${granted.join(', ') || 'нет'}`)
  }

  return lines.join('\n')
}
