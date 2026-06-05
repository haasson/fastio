import type { H3Event } from 'h3'
import type { Tenant } from '@fastio/shared'
import { DEFAULT_TABLE_SETTINGS } from '@fastio/shared'
import * as Sentry from '@sentry/nuxt'
import { reportError } from '@fastio/shared/observability'
import { getServerSupabase, mapTenant } from '../utils/supabase'
import { lookupTenantByHost } from '../utils/tenantCache'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  if (url.pathname.startsWith('/_nuxt') || url.pathname.startsWith('/__nuxt')) return
  // PREPROD-221: liveness-probe Coolify/Traefik бьёт сюда раз в N секунд.
  // Без skip каждый probe сходит в БД (`tenants` lookup) — мусорный трафик
  // и зависимость health-check от внешней БД. /api/health сам по себе
  // делает min-query к БД, дублировать tenant-lookup незачем.
  if (url.pathname === '/api/health' || url.pathname.startsWith('/api/health/')) return

  const host = getRequestHeader(event, 'x-original-host') || getRequestHost(event)
  const domain = host.split(':')[0]
  // SEC-03 / D-07: пустой домен → неверный Host header, не идём в БД
  if (!domain) throw createError({ statusCode: 503, message: 'Missing or invalid Host header' })
  const supabase = getServerSupabase()

  // PREPROD-112: кэш стабильной части Tenant + защита от stampede.
  // subscription освежается отдельно — см. mergeFreshSubscription.
  const result = await lookupTenantByHost(domain, () => doDbLookup(supabase, domain))

  if (result.tenant) {
    // Cache-hit может нести stale subscription.status (admin/billing-job
    // обновили БД после кэширования). Без freshness suspended-tenant
    // продолжал бы принимать заказы до 60s. На fresh-пути subscription
    // только что из БД → re-fetch не нужен.
    const tenant = result.source === 'cache'
      ? await mergeFreshSubscription(supabase, result.tenant)
      : result.tenant
    applyTenantToContext(event, tenant)
    // D-01: tag every subsequent server error in this request with the tenant
    // slug so GlitchTip issues are filterable per tenant without per-catch-block
    // instrumentation. slug is always present on a resolved Tenant.
    if (tenant.slug) Sentry.setTag('tenant', tenant.slug)
    assertNotSuspended(tenant, url)
    return
  }

  return devFallbackOrThrow(event, supabase, url)
})

async function doDbLookup(
  supabase: ReturnType<typeof getServerSupabase>,
  domain: string,
): Promise<Tenant | null> {
  const slug = domain.split('.')[0]
  const [domainRes, slugRes] = await Promise.all([
    supabase.from('tenants').select('*').eq('custom_domain', domain).maybeSingle(),
    supabase.from('tenants').select('*').eq('slug', slug).maybeSingle(),
  ])

  if (domainRes.error) reportError(domainRes.error)
  if (slugRes.error) reportError(slugRes.error)

  const tenant = domainRes.data ?? slugRes.data
  if (tenant) {
    const mapped = mapTenant(tenant)
    await computeDeliveryAvailable(supabase, mapped)
    await computeBookingEnabled(supabase, mapped)
    return mapped
  }

  // Не нашли тенанта НИ в одном успешном запросе. Если при этом был
  // partial failure (один запрос упал, второй вернул null) — мы не
  // можем быть уверены, что тенант реально не существует: упавший
  // запрос мог его найти. Throw 503 вместо negative-cache, чтобы
  // следующий request мог retry. Если оба упали — тем более 503.
  // Если оба отработали и оба вернули null — это легитимный «not found»,
  // его и возвращаем (lookupTenantByHost закэширует на TTL_MISS_MS).
  if (domainRes.error || slugRes.error) {
    throw createError({ statusCode: 503, message: 'Database temporarily unavailable' })
  }

  return null
}

async function mergeFreshSubscription(
  supabase: ReturnType<typeof getServerSupabase>,
  cached: Tenant,
): Promise<Tenant> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('subscription')
      .eq('id', cached.id)
      .maybeSingle()
    if (error) {
      reportError(error)
      // Fail-open: при DB-хикке используем cached subscription, чтобы
      // не валить весь storefront. Кратковременная stale-видимость
      // приемлема — это худшее, что может случиться при недоступной БД.
      return cached
    }
    if (!data || data.subscription == null) return cached
    return { ...cached, subscription: data.subscription as Tenant['subscription'] }
  } catch (e) {
    reportError(e)
    return cached
  }
}

function applyTenantToContext(event: H3Event, tenant: Tenant): void {
  event.context.tenantId = tenant.id
  event.context.tenant = tenant
}

function assertNotSuspended(tenant: Tenant, url: URL): void {
  // PREPROD-117 + Wave-5 CR-01: на suspended-тенанте Vue-роуты редиректит
  // middleware/suspended.global.ts на /suspended, но API под /api/* минует
  // page-middleware → без этой защиты POST /api/orders, POST /api/customer/*
  // и т.п. продолжают работать и заведение получает заказы в просрочке.
  // Whitelist симметричен page-middleware: auth-flow и health/tenant lookup —
  // открыты, чтобы юзер мог залогиниться и UI смог проверить статус.
  if (tenant.subscription?.status !== 'suspended') return
  if (!url.pathname.startsWith('/api/')) return

  const allowed = url.pathname.startsWith('/api/auth/')
    || url.pathname.startsWith('/api/health')
    || url.pathname === '/api/tenant'
  if (!allowed) {
    throw createError({ statusCode: 503, message: 'Заведение временно недоступно' })
  }
}

async function devFallbackOrThrow(
  event: H3Event,
  supabase: ReturnType<typeof getServerSupabase>,
  url: URL,
): Promise<void> {
  // Dev fallback: ?slug=demo-pizza or slug from Referer header (для client-side
  // API вызовов, где referer хранит slug). Намеренно не кэшируется — ключ был бы
  // per-query-slug, а не per-host; в проде это не работает (Coolify Traefik
  // routing по domain). Бьём БД каждый раз — норма для dev.
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
        await computeBookingEnabled(supabase, mapped)
        applyTenantToContext(event, mapped)
        if (mapped.slug) Sentry.setTag('tenant', mapped.slug)
        // Применяем suspended-guard и в dev-пути тоже — иначе локально
        // suspended-тенант продолжал бы обслуживать API, что мешает
        // тестировать billing-флоу.
        assertNotSuspended(mapped, url)
        return
      }
    }
  }

  // SEC-03 / D-06: 503, not 404 — avoid tenant enumeration; signal retry-able to load balancer.
  throw createError({ statusCode: 503, message: 'Tenant not found' })
}

async function computeDeliveryAvailable(
  supabase: ReturnType<typeof getServerSupabase>,
  tenant: Tenant,
): Promise<void> {
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

// Приём онлайн-броней = модуль «Столы» (dineIn) включён И под-флаг booking_enabled
// в table_settings. Нет строки table_settings → дефолт DEFAULT_TABLE_SETTINGS.
// Кэшируется вместе с tenant (как deliveryAvailable); серверный энфорсмент в
// reservations-эндпоинтах читает table_settings свежим.
async function computeBookingEnabled(
  supabase: ReturnType<typeof getServerSupabase>,
  tenant: Tenant,
): Promise<void> {
  if (!tenant.modules.dineIn) {
    tenant.bookingEnabled = false

    return
  }
  const { data } = await supabase
    .from('table_settings')
    .select('booking_enabled')
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  tenant.bookingEnabled = data?.booking_enabled ?? DEFAULT_TABLE_SETTINGS.bookingEnabled
}
