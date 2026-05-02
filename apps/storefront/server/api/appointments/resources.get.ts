import { getTenantDb } from '../../utils/tenantDb'

export default defineEventHandler(async (event) => {
  const db = getTenantDb(event)

  const query = getQuery(event)
  const serviceId = query.serviceId as string | undefined
  const branchId = query.branchId as string | undefined

  if (!serviceId) throw createError({ statusCode: 400, message: 'Параметр serviceId обязателен' })

  const { data: tenantData } = await db
    .from('tenants')
    .select('modules')
    .single()

  if (!tenantData?.modules?.services) {
    throw createError({ statusCode: 400, message: 'Онлайн-запись недоступна' })
  }

  const [{ data: settingsData }, { data: serviceData }] = await Promise.all([
    db
      .from('appointment_settings')
      .select('staff_name_format')
      .maybeSingle(),
    db
      .from('services')
      .select('allow_resource_choice, category_id')
      .eq('id', serviceId)
      .maybeSingle(),
  ])

  // Tenant validation: serviceId must belong to this tenant — иначе 404,
  // чтобы не утекали данные ресурсов/категорий чужого тенанта.
  if (!serviceData) throw createError({ statusCode: 404, message: 'Услуга не найдена' })

  const nameFormat = (settingsData?.staff_name_format as string) ?? 'full_name'
  const allowChoice = serviceData.allow_resource_choice ?? true

  if (!allowChoice) return []

  // Эффективные ресурсы = явные через service_resources ∪ через категорию (resource_categories)
  // safe: serviceId and category_id are validated against tenantId in the services query above
  const [{ data: explicitData }, { data: categoryData }] = await Promise.all([
    db.junction('service_resources').select('resource_id').eq('service_id', serviceId),
    serviceData?.category_id
      ? db.junction('resource_categories').select('resource_id').eq('category_id', serviceData.category_id as string)
      : Promise.resolve({ data: [] as { resource_id: string }[] }),
  ])

  const ids = Array.from(new Set([
    ...(explicitData ?? []).map((r) => r.resource_id as string),
    ...(categoryData ?? []).map((r) => r.resource_id as string),
  ]))

  if (!ids.length) return []

  const { data: resources } = await db
    .from('resources')
    .select('id, name, type, is_active')
    .in('id', ids)
    .eq('is_active', true)

  let active = (resources ?? []) as { id: string; name: string; type: string; is_active: boolean }[]

  if (branchId && active.length) {
    const { data: branchLinks } = await db
      .junction('resource_branches')
      .select('resource_id, branch_id')
      .in('resource_id', active.map((r) => r.id))

    const linksByResource = new Map<string, string[]>()
    for (const row of (branchLinks ?? []) as { resource_id: string; branch_id: string }[]) {
      const arr = linksByResource.get(row.resource_id) ?? []
      arr.push(row.branch_id)
      linksByResource.set(row.resource_id, arr)
    }

    active = active.filter((r) => {
      const links = linksByResource.get(r.id) ?? []
      return links.length === 0 || links.includes(branchId)
    })
  }

  const result = active.map((r) => ({ id: r.id, name: formatName(r.name, nameFormat), type: r.type }))
  if (result.length === 0) return []
  return result
})

function formatName(name: string, format: string): string {
  if (format === 'first_name') return name.split(' ')[0] ?? name
  if (format === 'first_name_last_initial') {
    // split() с одним пробелом-разделителем: "Анна  К." → ['Анна', '', 'К.']
    // → parts[1] === '' → parts[1][0] упадёт. Защищаемся optional chaining.
    const parts = name.split(' ').filter(Boolean)
    if (parts.length >= 2) {
      const initial = parts[1]?.[0] ?? ''
      return initial ? `${parts[0]} ${initial}.` : (parts[0] ?? name)
    }
    return name
  }
  return name
}
