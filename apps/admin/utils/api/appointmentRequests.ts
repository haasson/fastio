import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppointmentRequest, AppointmentGroup, Resource, AppointmentRequestService } from '@fastio/shared'
import { mapAppointmentRequest, mapAppointmentGroup, mapResource } from '@fastio/shared'

export type RequestFilter = 'new' | 'archive' | 'all'

const FIELDS = '*'

export const appointmentRequestsApi = {
  async list(
    sb: SupabaseClient,
    tenantId: string,
    opts: {
      page: number
      pageSize: number
      filter: RequestFilter
    },
  ): Promise<{ data: AppointmentRequest[]; total: number }> {
    let q = sb
      .from('appointment_requests')
      .select(FIELDS, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (opts.filter === 'new') q = q.in('status', ['new', 'in_progress'])
    else if (opts.filter === 'archive') q = q.in('status', ['converted', 'declined'])

    const from = (opts.page - 1) * opts.pageSize

    q = q.range(from, from + opts.pageSize - 1)

    const { data, count, error } = await q

    if (error) throw new Error(error.message)

    return {
      data: (data ?? []).map((r) => mapAppointmentRequest(r as Record<string, unknown>)),
      total: count ?? 0,
    }
  },

  async loadById(sb: SupabaseClient, id: string): Promise<AppointmentRequest | null> {
    const { data, error } = await sb
      .from('appointment_requests')
      .select(FIELDS)
      .eq('id', id)
      .maybeSingle()

    if (error) throw new Error(error.message)

    return data ? mapAppointmentRequest(data as Record<string, unknown>) : null
  },

  async loadRequestViewData(
    sb: SupabaseClient,
    id: string,
  ): Promise<{
    request: AppointmentRequest | null
    preferredResources: Resource[]
    processor: { id: string; name: string } | null
    convertedGroup: AppointmentGroup | null
  }> {
    const { data, error } = await sb.from('appointment_requests').select('*').eq('id', id).maybeSingle()

    if (error) throw new Error(error.message)

    const request = data ? mapAppointmentRequest(data as Record<string, unknown>) : null

    if (!request) return { request: null, preferredResources: [], processor: null, convertedGroup: null }

    const preferredResourceIds = [...new Set(
      request.services.map((s) => s.preferredResourceId).filter((rid): rid is string => rid !== null),
    )]

    const [resourcesRes, processedRes, groupRes] = await Promise.all([
      preferredResourceIds.length
        ? sb.from('resources').select('*').in('id', preferredResourceIds)
        : Promise.resolve({ data: [], error: null }),
      request.processedBy
        ? sb.rpc('get_user_profiles_for_tenant', {
            p_tenant_id: request.tenantId,
            p_user_ids: [request.processedBy],
          })
        : Promise.resolve({ data: [], error: null }),
      request.convertedGroupId
        ? sb.from('appointment_groups').select('*').eq('id', request.convertedGroupId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    if (resourcesRes.error) throw new Error(resourcesRes.error.message)
    if (processedRes.error) throw new Error(processedRes.error.message)
    if (groupRes.error) throw new Error(groupRes.error.message)

    type UserProfileRow = { user_id: string; email: string; full_name: string }
    const processorRow = (processedRes.data ?? [] as UserProfileRow[])[0] as UserProfileRow | undefined
    const processor = processorRow
      ? { id: processorRow.user_id, name: processorRow.full_name || processorRow.email || 'Администратор' }
      : null

    return {
      request,
      preferredResources: (resourcesRes.data ?? []).map((r) => mapResource(r as Record<string, unknown>)),
      processor,
      convertedGroup: groupRes.data ? mapAppointmentGroup(groupRes.data as Record<string, unknown>) : null,
    }
  },

  async countNew(sb: SupabaseClient, tenantId: string): Promise<number> {
    const { count, error } = await sb
      .from('appointment_requests')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['new', 'in_progress'])

    if (error) throw new Error(error.message)

    return count ?? 0
  },

  async decline(sb: SupabaseClient, id: string, processedBy: string): Promise<void> {
    const { error } = await sb
      .from('appointment_requests')
      .update({
        status: 'declined',
        processed_by: processedBy,
        processed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  async markInProgress(sb: SupabaseClient, id: string, processedBy: string): Promise<void> {
    const { error } = await sb
      .from('appointment_requests')
      .update({
        status: 'in_progress',
        processed_by: processedBy,
        processed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  async markConverted(
    sb: SupabaseClient,
    id: string,
    groupId: string,
    processedBy: string,
  ): Promise<void> {
    const { error } = await sb
      .from('appointment_requests')
      .update({
        status: 'converted',
        converted_group_id: groupId,
        processed_by: processedBy,
        processed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  /**
   * Обновляет метаданные заявки. Принимает camelCase, маппит в snake_case
   * (DB column `services` jsonb хранит элементы snake_case — см. migration 218).
   */
  async updateMeta(
    sb: SupabaseClient,
    id: string,
    payload: {
      customerName?: string
      customerPhone?: string
      customerEmail?: string | null
      notes?: string | null
      services?: AppointmentRequestService[]
    },
  ): Promise<void> {
    const p: Record<string, unknown> = {}

    if (payload.customerName !== undefined) p.customer_name = payload.customerName
    if (payload.customerPhone !== undefined) p.customer_phone = payload.customerPhone
    if (payload.customerEmail !== undefined) p.customer_email = payload.customerEmail
    if (payload.notes !== undefined) p.notes = payload.notes
    if (payload.services !== undefined) {
      p.services = payload.services.map((s) => ({
        service_id: s.serviceId,
        service_name: s.serviceName,
        preferred_resource_id: s.preferredResourceId,
        duration_minutes: s.durationMinutes,
        price: s.price,
      }))
    }

    if (Object.keys(p).length === 0) return

    const { error } = await sb
      .from('appointment_requests')
      .update(p)
      .eq('id', id)

    if (error) throw new Error(error.message)
  },
}
