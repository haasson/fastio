import { getServerSupabase } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const tenantId = event.context.tenantId as string | undefined
  if (!tenantId) throw createError({ statusCode: 404 })

  const supabase = getServerSupabase()

  const { data: tenantData } = await supabase
    .from('tenants')
    .select('modules')
    .eq('id', tenantId)
    .single()

  if (!tenantData?.modules?.services) {
    throw createError({ statusCode: 400, message: 'Онлайн-запись недоступна' })
  }

  const { data: servicesData } = await supabase
    .from('services')
    .select('id, name, description, price, duration, photos, tags, category_id, booking_mode, allow_resource_choice')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .eq('is_bookable', true)
    .order('sort_order')

  const serviceIds = (servicesData ?? []).map((s) => s.id as string)
  const { data: branchLinksData } = serviceIds.length
    ? await supabase.from('service_branches').select('service_id, branch_id').in('service_id', serviceIds)
    : { data: [] as { service_id: string; branch_id: string }[] }

  const branchIdsByService = new Map<string, string[]>()
  for (const row of (branchLinksData ?? []) as { service_id: string; branch_id: string }[]) {
    const arr = branchIdsByService.get(row.service_id) ?? []
    arr.push(row.branch_id)
    branchIdsByService.set(row.service_id, arr)
  }

  return (servicesData ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    price: (row.price as number) ?? 0,
    duration: row.duration as number,
    photos: (row.photos as string[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    categoryId: row.category_id as string | null,
    bookingMode: ((row.booking_mode as string) ?? 'fixed') as 'fixed' | 'open_ended',
    allowResourceChoice: (row.allow_resource_choice as boolean) ?? true,
    branchIds: branchIdsByService.get(row.id as string) ?? [],
  }))
})
