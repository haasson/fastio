import { getServerSupabase, mapTenant } from '../utils/supabase'

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  if (url.pathname.startsWith('/_nuxt') || url.pathname.startsWith('/__nuxt')) return

  const supabase = getServerSupabase()
  const host = getRequestHeader(event, 'x-forwarded-host') || getRequestHost(event)
  // eslint-disable-next-line no-console
  console.log('host:', host)
  // eslint-disable-next-line no-console
  console.log('x-forwarded-host:', getRequestHeader(event, 'x-forwarded-host'))
  // eslint-disable-next-line no-console
  console.log('original host:', getRequestHost(event))
  const domain = host.split(':')[0]
  const slug = domain.split('.')[0]

  // Сначала ищем по кастомному домену
  const { data: byDomain } = await supabase
    .from('tenants')
    .select('*')
    .eq('custom_domain', domain)
    .maybeSingle()

  if (byDomain) {
    event.context.tenantId = byDomain.id
    event.context.tenant = mapTenant(byDomain)
    checkSuspended(event.context.tenant)
    return
  }

  // Fallback: поддомен вида slug.platform.com
  const { data: bySlug } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (bySlug) {
    event.context.tenantId = bySlug.id
    event.context.tenant = mapTenant(bySlug)
    checkSuspended(event.context.tenant)
    return
  }

  // Dev fallback: ?slug=demo-pizza
  const querySlug = import.meta.dev
    ? (getQuery(event).slug as string | undefined)
    : undefined
  if (querySlug) {
    const { data: byQuerySlug } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', querySlug)
      .maybeSingle()

    if (byQuerySlug) {
      event.context.tenantId = byQuerySlug.id
      event.context.tenant = mapTenant(byQuerySlug)
      checkSuspended(event.context.tenant)
      return
    }
  }

  throw createError({ statusCode: 404, message: 'Tenant not found' })
})

function checkSuspended(tenant: ReturnType<typeof mapTenant>) {
  if (tenant.subscription?.status === 'suspended') {
    throw createError({ statusCode: 503, message: 'Заведение временно недоступно' })
  }
}
