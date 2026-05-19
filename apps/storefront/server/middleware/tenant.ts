import { getServerSupabase, mapTenant } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  if (url.pathname.startsWith('/_nuxt') || url.pathname.startsWith('/__nuxt')) return

  const supabase = getServerSupabase()
  const host = getRequestHeader(event, 'x-original-host') || getRequestHost(event)
  const domain = host.split(':')[0]
  const slug = domain.split('.')[0]

  // Ищем по кастомному домену и slug параллельно
  const [{ data: byDomain }, { data: bySlug }] = await Promise.all([
    supabase.from('tenants').select('*').eq('custom_domain', domain).maybeSingle(),
    supabase.from('tenants').select('*').eq('slug', slug).maybeSingle(),
  ])

  const tenant = byDomain ?? bySlug
  if (tenant) {
    const mapped = mapTenant(tenant)
    await computeDeliveryAvailable(supabase, mapped)
    event.context.tenantId = tenant.id
    event.context.tenant = mapped

    // PREPROD-117 + Wave-5 CR-01: на suspended-тенанте Vue-роуты редиректит
    // `middleware/suspended.global.ts` на /suspended, но API под /api/* минует
    // page-middleware → без этой защиты POST /api/orders, POST /api/customer/*
    // и т.п. продолжают работать и заведение получает заказы в просрочке.
    // Whitelist симметричен page-middleware: auth-flow и health/tenant lookup —
    // открыты, чтобы юзер мог залогиниться и UI смог проверить статус.
    if (mapped.subscription?.status === 'suspended' && url.pathname.startsWith('/api/')) {
      const allowed = url.pathname.startsWith('/api/auth/')
        || url.pathname.startsWith('/api/health')
        || url.pathname === '/api/tenant'
      if (!allowed) {
        throw createError({ statusCode: 503, message: 'Заведение временно недоступно' })
      }
    }

    return
  }

  // Dev fallback: ?slug=demo-pizza or slug from Referer header (for client-side API calls)
  if (import.meta.dev) {
    const querySlug = getQuery(event).slug as string | undefined
    const referer = getRequestHeader(event, 'referer')
    let refererSlug: string | undefined
    if (referer) {
      try { refererSlug = new URL(referer).searchParams.get('slug') ?? undefined } catch { /* ignore */ }
    }
    const devSlug = querySlug ?? refererSlug
    if (devSlug) {
      const { data: byDevSlug } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', devSlug)
        .maybeSingle()

      if (byDevSlug) {
        const mapped = mapTenant(byDevSlug)
        await computeDeliveryAvailable(supabase, mapped)
        event.context.tenantId = byDevSlug.id
        event.context.tenant = mapped
        return
      }
    }
  }

  throw createError({ statusCode: 404, message: 'Tenant not found' })
})

async function computeDeliveryAvailable(supabase: ReturnType<typeof getServerSupabase>, tenant: ReturnType<typeof mapTenant>) {
  if (tenant.modules.delivery) {
    if (tenant.deliveryMode === 'fixed') {
      tenant.deliveryAvailable = true
    } else {
      // One query: count active zones joined with active non-archived branches
      const { count } = await supabase
        .from('delivery_zones')
        .select('id, branches!inner(id)', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .eq('branches.is_active', true)
        .is('branches.archived_at', null)
      tenant.deliveryAvailable = (count ?? 0) > 0
    }
  }
  tenant.orderingEnabled = tenant.deliveryAvailable || tenant.modules.pickup
}
