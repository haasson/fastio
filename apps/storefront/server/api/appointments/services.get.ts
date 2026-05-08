import { getTenantDb } from '../../utils/tenantDb'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const query = getQuery(event)
  const branchIdRaw = (query.branchId as string | undefined)?.trim() || null
  if (branchIdRaw && !UUID_REGEX.test(branchIdRaw)) {
    throw createError({ statusCode: 400, message: 'Некорректный идентификатор филиала' })
  }

  const { data: tenantData } = await db
    .from('tenants')
    .select('modules, branch_selection_mode')
    .single()

  if (!tenantData?.modules?.services) {
    throw createError({ statusCode: 400, message: 'Онлайн-запись недоступна' })
  }

  // Подтверждаем что branchId реально принадлежит этому тенанту (защита
  // от подделки query-параметра + защита от устаревших id из localStorage).
  let branchId: string | null = null
  if (branchIdRaw) {
    const { data: branchRow } = await db
      .from('branches')
      .select('id')
      .eq('id', branchIdRaw)
      .maybeSingle()
    if (branchRow) branchId = branchIdRaw
  }

  const { data: servicesData } = await db
    .from('services')
    .select('id, name, description, price, duration, photos, tags, category_id, booking_mode, max_duration, allow_resource_choice')
    .eq('active', true)
    .eq('is_bookable', true)
    .order('sort_order')
    .order('name')

  const serviceIds = (servicesData ?? []).map((s) => s.id as string)
  const { data: branchLinksData } = serviceIds.length
    ? await db.junction('service_branches').select('service_id, branch_id').in('service_id', serviceIds)
    : { data: [] as { service_id: string; branch_id: string }[] }

  const branchIdsByService = new Map<string, string[]>()
  for (const row of (branchLinksData ?? []) as { service_id: string; branch_id: string }[]) {
    const arr = branchIdsByService.get(row.service_id) ?? []
    arr.push(row.branch_id)
    branchIdsByService.set(row.service_id, arr)
  }

  const allServices = (servicesData ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    price: (row.price as number) ?? 0,
    duration: row.duration as number,
    photos: (row.photos as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    categoryId: row.category_id as string | null,
    bookingMode: ((row.booking_mode as string) ?? 'fixed') as 'fixed' | 'variable',
    maxDuration: (row.max_duration as number | null) ?? null,
    allowResourceChoice: (row.allow_resource_choice as boolean) ?? true,
    branchIds: branchIdsByService.get(row.id as string) ?? [],
  }))

  // Фильтр применяем только в per_branch-режиме (синхронизация с /api/services-catalog).
  // В unified-режиме клиенту отдаём весь список, чтобы он мог показать бейджи
  // «доступно не во всех филиалах» через branchIds[].
  if (branchId && tenantData.branch_selection_mode === 'per_branch') {
    return allServices.filter(
      (s) => s.branchIds.length === 0 || s.branchIds.includes(branchId),
    )
  }

  return allServices
})
