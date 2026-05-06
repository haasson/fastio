import type { Tenant, DishTagDefinition, ServiceCard } from '@fastio/shared'
import { mapCategory } from '@fastio/shared'
import { getTenantDb } from '../utils/tenantDb'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)
  const tenant = event.context.tenant as Tenant | undefined

  if (!tenant) throw createError({ statusCode: 404 })

  const empty = { categories: [], services: [], tagDefinitions: [], tagDisplayMode: 'both' as const }

  if (tenant.businessType !== 'services' || !tenant.modules?.services) return empty

  const query = getQuery(event)
  const requestedBranchId = typeof query.branchId === 'string' ? query.branchId : null

  const [{ data: categoriesData }, { data: servicesData }, { data: tagRowsData }] = await Promise.all([
    db
      .from('categories')
      .select('*')
      .eq('kind', 'service')
      .eq('active', true)
      .is('deleted_at', null)
      .order('sort_order'),
    db
      .from('services')
      .select('id, tenant_id, category_id, name, description, long_description, price, duration, photos, tags, is_bookable, booking_mode, max_duration, allow_resource_choice')
      .eq('active', true)
      .order('sort_order')
      .order('name'),
    db.from('dish_tags').select('*').order('sort_order'),
  ])

  // service_branches has no tenant_id column; safe: serviceIds are derived from the
  // tenant-validated services query above (.eq('tenant_id', tenantId))
  const serviceIds = (servicesData ?? []).map((r) => r.id as string)
  const { data: serviceBranchData } = serviceIds.length
    ? await db.junction('service_branches').select('service_id, branch_id').in('service_id', serviceIds)
    : { data: [] as { service_id: string; branch_id: string }[] }

  const branchIdsByService = new Map<string, string[]>()
  for (const row of (serviceBranchData ?? []) as { service_id: string; branch_id: string }[]) {
    const arr = branchIdsByService.get(row.service_id) ?? []
    arr.push(row.branch_id)
    branchIdsByService.set(row.service_id, arr)
  }

  const allServices: ServiceCard[] = (servicesData ?? []).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    categoryId: (row.category_id as string | null) ?? null,
    name: row.name as string,
    description: (row.description as string) ?? '',
    longDescription: (row.long_description as string | null) ?? null,
    price: (row.price as number) ?? 0,
    duration: row.duration as number,
    photos: (row.photos as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    isBookable: (row.is_bookable as boolean) ?? false,
    bookingMode: ((row.booking_mode as string) ?? 'fixed') as 'fixed' | 'variable',
    maxDuration: (row.max_duration as number | null) ?? null,
    allowResourceChoice: (row.allow_resource_choice as boolean) ?? true,
    branchIds: branchIdsByService.get(row.id as string) ?? [],
  }))

  // В режиме per_branch отдаём только услуги, привязанные к выбранному филиалу
  // (или с пустым branchIds = «во всех филиалах»).
  const services
    = tenant.branchSelectionMode === 'per_branch' && requestedBranchId
      ? allServices.filter(
        (s) => s.branchIds.length === 0 || s.branchIds.includes(requestedBranchId),
      )
      : allServices

  // Теги услуг живут только в `services.tags` (text[]) — отдельной junction-таблицы нет.
  // dish_tag_assignments — это для блюд, не для услуг.

  const tagDefinitions: DishTagDefinition[] = (tagRowsData ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    tenantId: r.tenant_id as string,
    name: r.name as string,
    icon: r.icon as string,
    color: r.color as string,
    sortOrder: r.sort_order as number,
  }))

  const tagDisplayMode = tenant.siteLayout?.sections?.menu?.tagDisplayMode ?? 'both'

  return {
    categories: (categoriesData ?? []).map(mapCategory),
    services,
    tagDefinitions,
    tagDisplayMode,
  }
})
