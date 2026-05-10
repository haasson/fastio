import type { SupabaseClient } from '@supabase/supabase-js'
import type { BookingMode, Service, ServiceFormData, ServiceWithBranchIds } from '@fastio/shared'
import { mapService } from '@fastio/shared'
import type { ServiceRow } from '~/utils/api/db-types'
import { query } from '~/utils/query'

const SERVICE_FIELDS = `
  id, tenant_id, category_id, name, description, long_description, price, duration,
  photos, tags, is_bookable, booking_mode, max_duration, allow_resource_choice,
  active, sort_order, created_at, updated_at
`.trim()

const fillBranchIds = async (
  sb: SupabaseClient,
  services: Service[],
): Promise<ServiceWithBranchIds[]> => {
  if (services.length === 0) return []
  const ids = services.map((s) => s.id)
  const { data } = await sb.from('service_branches').select('service_id, branch_id').in('service_id', ids)
  const byService = new Map<string, string[]>()

  for (const row of (data ?? []) as { service_id: string; branch_id: string }[]) {
    const arr = byService.get(row.service_id) ?? []

    arr.push(row.branch_id)
    byService.set(row.service_id, arr)
  }

  return services.map((s) => ({ ...s, branchIds: byService.get(s.id) ?? [] }))
}

const writeServicePatch = (form: Partial<ServiceFormData>): Record<string, unknown> => {
  const patch: Record<string, unknown> = {}

  if (form.categoryId !== undefined) patch.category_id = form.categoryId
  if (form.name !== undefined) patch.name = form.name
  if (form.description !== undefined) patch.description = form.description
  if (form.price !== undefined) patch.price = form.price
  if (form.duration !== undefined) patch.duration = form.duration
  if (form.photos !== undefined) patch.photos = form.photos
  if (form.tags !== undefined) patch.tags = form.tags
  if (form.isBookable !== undefined) patch.is_bookable = form.isBookable
  if (form.bookingMode !== undefined) patch.booking_mode = form.bookingMode
  if (form.maxDuration !== undefined) patch.max_duration = form.maxDuration
  if (form.allowResourceChoice !== undefined) patch.allow_resource_choice = form.allowResourceChoice
  if (form.active !== undefined) patch.active = form.active
  if (form.sortOrder !== undefined) patch.sort_order = form.sortOrder
  if (form.longDescription !== undefined) patch.long_description = form.longDescription ?? null

  return patch
}

const setBranchIds = async (sb: SupabaseClient, serviceId: string, branchIds: string[]): Promise<void> => {
  // Atomic via RPC: delete + insert in one transaction. Avoids the half-written
  // state we got when the client previously did two separate requests.
  await query(
    sb.rpc('services_set_branch_ids', {
      p_service_id: serviceId,
      p_branch_ids: branchIds,
    }),
  )
}

export const servicesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<ServiceWithBranchIds[]> {
    const data = await query(
      sb.from('services').select(SERVICE_FIELDS).eq('tenant_id', tenantId).order('sort_order').order('name'),
    )
    const services = (data ?? []).map((r) => mapService(r as unknown as ServiceRow))

    return fillBranchIds(sb, services)
  },

  async listActive(sb: SupabaseClient, tenantId: string): Promise<ServiceWithBranchIds[]> {
    const data = await query(
      sb.from('services').select(SERVICE_FIELDS).eq('tenant_id', tenantId).eq('active', true).order('sort_order').order('name'),
    )
    const services = (data ?? []).map((r) => mapService(r as unknown as ServiceRow))

    return fillBranchIds(sb, services)
  },

  /** Возвращает только branchIds услуги — для случаев когда полный объект не нужен. */
  async getBranchIds(sb: SupabaseClient, serviceId: string): Promise<string[]> {
    const { data } = await sb.from('service_branches').select('branch_id').eq('service_id', serviceId)

    return (data ?? []).map((r) => (r as { branch_id: string }).branch_id)
  },

  async create(sb: SupabaseClient, tenantId: string, form: ServiceFormData): Promise<ServiceWithBranchIds> {
    const result = await query(
      sb.from('services').insert({
        tenant_id: tenantId,
        category_id: form.categoryId ?? null,
        name: form.name,
        description: form.description,
        price: form.price,
        duration: form.duration,
        photos: form.photos,
        tags: form.tags,
        is_bookable: form.isBookable,
        booking_mode: form.bookingMode,
        max_duration: form.maxDuration ?? null,
        allow_resource_choice: form.allowResourceChoice,
        active: form.active,
        sort_order: form.sortOrder,
        long_description: form.longDescription ?? null,
      }).select(SERVICE_FIELDS).single(),
    )
    const service = mapService(result as unknown as ServiceRow)

    await setBranchIds(sb, service.id, form.branchIds)

    return { ...service, branchIds: form.branchIds }
  },

  async update(sb: SupabaseClient, id: string, form: Partial<ServiceFormData>): Promise<ServiceWithBranchIds> {
    const result = await query(
      sb.from('services').update(writeServicePatch(form)).eq('id', id).select(SERVICE_FIELDS).single(),
    )
    const service = mapService(result as unknown as ServiceRow)

    if (form.branchIds !== undefined) {
      await setBranchIds(sb, id, form.branchIds)

      return { ...service, branchIds: form.branchIds }
    }

    const filled = await fillBranchIds(sb, [service])

    return filled[0]
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('services').delete().eq('id', id))
  },

  async reorder(sb: SupabaseClient, items: { id: string; sortOrder: number }[]): Promise<void> {
    await Promise.all(
      items.map(({ id, sortOrder }) => query(sb.from('services').update({ sort_order: sortOrder }).eq('id', id))),
    )
  },

  async countsByCategory(sb: SupabaseClient, tenantId: string): Promise<Record<string, number>> {
    const data = await query(sb.from('services').select('category_id').eq('tenant_id', tenantId))
    const counts: Record<string, number> = {}

    for (const row of (data ?? []) as { category_id: string | null }[]) {
      if (!row.category_id) continue
      counts[row.category_id] = (counts[row.category_id] ?? 0) + 1
    }

    return counts
  },

  async countMismatch(
    sb: SupabaseClient,
    tenantId: string,
    defaults: { isBookable?: boolean; bookingMode?: BookingMode; allowResourceChoice?: boolean },
  ): Promise<number> {
    const filters: string[] = []

    if (defaults.isBookable !== undefined) filters.push(`is_bookable.neq.${defaults.isBookable}`)
    if (defaults.bookingMode !== undefined) filters.push(`booking_mode.neq.${defaults.bookingMode}`)
    if (defaults.allowResourceChoice !== undefined) filters.push(`allow_resource_choice.neq.${defaults.allowResourceChoice}`)
    if (filters.length === 0) return 0

    const { count, error } = await sb.from('services')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .or(filters.join(','))

    if (error) throw new Error(error.message)

    return count ?? 0
  },

  async bulkPatch(
    sb: SupabaseClient,
    tenantId: string,
    form: { isBookable?: boolean; bookingMode?: BookingMode; allowResourceChoice?: boolean },
  ): Promise<void> {
    const patch = writeServicePatch(form)

    if (Object.keys(patch).length === 0) return
    await query(sb.from('services').update(patch).eq('tenant_id', tenantId))
  },

  async uploadPhoto(sb: SupabaseClient, tenantId: string, file: File): Promise<string> {
    const { optimizeImage } = await import('~/utils/imageOptimize')
    const blob = await optimizeImage(file)
    const path = `services/${tenantId}/${crypto.randomUUID()}.webp`

    await query(sb.storage.from('dish-images').upload(path, blob, { contentType: 'image/webp' }))

    return sb.storage.from('dish-images').getPublicUrl(path).data.publicUrl
  },

  async deletePhoto(sb: SupabaseClient, url: string): Promise<void> {
    const marker = '/dish-images/'
    const idx = url.indexOf(marker)

    if (idx === -1) return
    await query(sb.storage.from('dish-images').remove([url.substring(idx + marker.length)]))
  },
}
