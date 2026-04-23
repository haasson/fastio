import type { PlanTier } from '@fastio/shared'
import { PLAN_TIER_LABELS, extractPlanTier, getPlanTierOrder } from '@fastio/shared'
import { getServerSupabase } from '~/server/utils/supabase'

export type AiContext = {
  tenantName: string
  siteUrl: string
  businessType: string | null
  menuStyle: string | null
  planKey: string
  planLabel: string
  modulesEnabled: string[]
  modulesDisabled: string[]
  modulesLocked: string[]
  modulesAbsent: string[]
  roleName: string | null
  permissions: Record<string, boolean>
}

type TenantRow = {
  name: string | null
  slug: string
  custom_domain: string | null
  business_type: string | null
  menu_style: string | null
  subscription: { plan?: string } | null
  modules: Record<string, boolean> | null
}

type RoleRow = { name: string; permissions: Record<string, boolean> }

type MemberRow = {
  role_id: string | null
  tenant_roles: RoleRow | RoleRow[] | null
}

type ModuleConfigRow = {
  key: string
  name: string
  required_plan_key: string
  business_types: string[]
  menu_styles: string[] | null
}

export async function fetchTenantContext(
  tenantId: string,
  userId: string,
): Promise<AiContext> {
  const sb = getServerSupabase()

  const [tenantResult, memberResult, moduleConfigsResult, plansResult] = await Promise.all([
    sb.from('tenants')
      .select('name, slug, custom_domain, business_type, menu_style, subscription, modules')
      .eq('id', tenantId)
      .single<TenantRow>(),
    sb.from('tenant_members')
      .select('role_id, tenant_roles(name, permissions)')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single<MemberRow>(),
    sb.from('module_configs')
      .select('key, name, required_plan_key, business_types, menu_styles')
      .eq('is_active', true),
    sb.from('plans')
      .select('key, business_type, features')
      .eq('is_active', true),
  ])

  if (tenantResult.error) console.error('[AI] Failed to fetch tenant:', tenantResult.error.message)
  if (memberResult.error) console.error('[AI] Failed to fetch member:', memberResult.error.message)
  if (moduleConfigsResult.error) console.error('[AI] Failed to fetch module_configs:', moduleConfigsResult.error.message)
  if (plansResult.error) console.error('[AI] Failed to fetch plans:', plansResult.error.message)

  const tenant = tenantResult.data
  const member = memberResult.data
  const moduleConfigs: ModuleConfigRow[] = (moduleConfigsResult.data ?? []) as ModuleConfigRow[]
  const allPlans = (plansResult.data ?? []) as { key: string; business_type: string; features: Record<string, unknown> }[]

  const isOwner = !member?.role_id
  const rawRole = member?.tenant_roles ?? null
  const role: RoleRow | null = Array.isArray(rawRole) ? rawRole[0] ?? null : rawRole

  const siteUrl = tenant?.custom_domain
    ? `https://${tenant.custom_domain}`
    : tenant?.slug
      ? `https://${tenant.slug}.fastio.ru`
      : ''

  const planKey = tenant?.subscription?.plan ?? 'retail-showcase'
  const planTier = extractPlanTier(planKey) as PlanTier
  const planOrder = getPlanTierOrder(planKey)
  const planLabel = PLAN_TIER_LABELS[planTier] ?? planTier

  const businessType = tenant?.business_type ?? null
  const menuStyle = tenant?.menu_style ?? null
  const tenantModules = tenant?.modules ?? {}

  const modulesEnabled: string[] = []
  const modulesDisabled: string[] = []
  const modulesLocked: string[] = []
  const modulesAbsent: string[] = []

  // Plan-only features (not in module_configs, not user-toggleable)
  const eligiblePlans = allPlans.filter(
    (p) => p.business_type === businessType && getPlanTierOrder(p.key) <= planOrder,
  )
  const planModules: Record<string, boolean> = {}

  for (const p of eligiblePlans) {
    const mods = (p.features as { modules?: Record<string, boolean> })?.modules ?? {}

    for (const [k, v] of Object.entries(mods)) {
      if (v === true) planModules[k] = true
    }
  }

  const PLAN_ONLY_FEATURES: { key: string; name: string }[] = [
    { key: 'dashboard', name: 'Дашборд (статистика)' },
    { key: 'team', name: 'Управление командой' },
  ]

  for (const feat of PLAN_ONLY_FEATURES) {
    if (planModules[feat.key]) {
      modulesEnabled.push(feat.name)
    } else {
      modulesLocked.push(`${feat.name} (требуется тариф Старт)`)
    }
  }

  for (const cfg of moduleConfigs) {
    const wrongBusinessType = businessType !== null && !cfg.business_types.includes(businessType)
    const wrongMenuStyle = cfg.menu_styles !== null && menuStyle !== null && !cfg.menu_styles.includes(menuStyle)
    const absent = wrongBusinessType || wrongMenuStyle

    if (absent) {
      modulesAbsent.push(cfg.name)
      continue
    }

    const requiredOrder = getPlanTierOrder(cfg.required_plan_key)
    const locked = planOrder < requiredOrder

    if (locked) {
      const tierLabel = PLAN_TIER_LABELS[cfg.required_plan_key as PlanTier] ?? cfg.required_plan_key

      modulesLocked.push(`${cfg.name} (требуется тариф ${tierLabel})`)
      continue
    }

    if (tenantModules[cfg.key]) {
      modulesEnabled.push(cfg.name)
    } else {
      modulesDisabled.push(cfg.name)
    }
  }

  return {
    tenantName: tenant?.name ?? '',
    siteUrl,
    businessType,
    menuStyle,
    planKey,
    planLabel,
    modulesEnabled,
    modulesDisabled,
    modulesLocked,
    modulesAbsent,
    roleName: isOwner ? 'Владелец' : (role?.name ?? null),
    permissions: isOwner ? {} : (role?.permissions ?? {}),
  }
}

const BIZ_LABELS: Record<string, string> = {
  retail: 'Розничная торговля / Общепит',
  services: 'Услуги',
}

const MENU_STYLE_LABELS: Record<string, string> = {
  food: 'Меню и блюда (ресторан/кафе)',
  catalog: 'Каталог товаров (магазин)',
}

export function formatContextForPrompt(ctx: AiContext): string {
  const lines: string[] = []

  lines.push(`Тенант: ${ctx.tenantName}`)

  if (ctx.siteUrl) lines.push(`Публичный сайт: ${ctx.siteUrl}`)

  if (ctx.businessType) {
    lines.push(`Тип бизнеса: ${BIZ_LABELS[ctx.businessType] ?? ctx.businessType}`)
  }

  if (ctx.businessType === 'retail' && ctx.menuStyle) {
    lines.push(`Стиль каталога: ${MENU_STYLE_LABELS[ctx.menuStyle] ?? ctx.menuStyle}`)
  }

  lines.push(`Тариф: ${ctx.planLabel} (${ctx.planKey})`)

  lines.push(`\nМодули ВКЛЮЧЕНЫ (активны и работают):`)
  lines.push(ctx.modulesEnabled.length ? ctx.modulesEnabled.map((m) => `  + ${m}`).join('\n') : '  — нет')

  lines.push(`\nМодули ВЫКЛЮЧЕНЫ (доступны на тарифе, но отключены вручную):`)
  lines.push(ctx.modulesDisabled.length ? ctx.modulesDisabled.map((m) => `  - ${m}`).join('\n') : '  — нет')

  lines.push(`\nМодули ЗАБЛОКИРОВАНЫ ТАРИФОМ (нужен апгрейд):`)
  lines.push(ctx.modulesLocked.length ? ctx.modulesLocked.map((m) => `  🔒 ${m}`).join('\n') : '  — нет')

  lines.push(`\nМодули НЕДОСТУПНЫ для этого типа бизнеса (не показывать, не упоминать):`)
  lines.push(ctx.modulesAbsent.length ? ctx.modulesAbsent.map((m) => `  ✗ ${m}`).join('\n') : '  — нет')

  lines.push(`\nРоль пользователя: ${ctx.roleName ?? 'неизвестна'}`)

  if (ctx.roleName === 'Владелец') {
    lines.push(`Права: все (владелец имеет полный доступ)`)
  } else {
    const granted = Object.entries(ctx.permissions).filter(([, v]) => v).map(([k]) => k)

    lines.push(`Права: ${granted.join(', ') || 'нет'}`)
  }

  return lines.join('\n')
}
