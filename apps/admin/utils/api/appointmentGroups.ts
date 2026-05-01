import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppointmentGroup, Appointment, Resource, AppointmentEvent } from '@fastio/shared'
import { mapAppointmentGroup, mapAppointment, mapResource, localDateTimeToUtcIso, addDaysToDateStr, todayInTz } from '@fastio/shared'
import { mapAppointmentEvent } from './appointment-events'

export type GroupFilter = 'new' | 'today' | 'week' | 'archive' | 'all'

const GROUP_FIELDS = `
  id, tenant_id, branch_id, customer_id, customer_name, customer_phone, customer_email,
  notes, status, total_price, total_duration_minutes, source, request_id, created_at, updated_at
`.trim()

// «Сегодня/неделя»: фильтр идёт через appointments.starts_at, а пагинация — по
// appointment_groups. Делаем в два запроса: сначала собираем group_id из
// appointments в окне даты, потом тянем сами группы. Альтернатива — JOIN/RPC,
// но при текущем масштабе (десятки записей в день на тенанта) разница незаметна.
// При росте данных см. TECHDEBT.md → переписать на один запрос.
const listByDate = async (
  sb: SupabaseClient,
  tenantId: string,
  opts: { page: number; pageSize: number; filter: 'today' | 'week'; tz: string },
): Promise<{ data: AppointmentGroup[]; total: number }> => {
  const todayStr = todayInTz(opts.tz)
  const startUtc = localDateTimeToUtcIso(todayStr, '00:00', opts.tz)
  const endDateStr = opts.filter === 'today' ? addDaysToDateStr(todayStr, 1) : addDaysToDateStr(todayStr, 7)
  const endUtc = localDateTimeToUtcIso(endDateStr, '00:00', opts.tz)

  const { data: apptRows, error: apptErr } = await sb
    .from('appointments')
    .select('group_id')
    .eq('tenant_id', tenantId)
    .gte('starts_at', startUtc)
    .lt('starts_at', endUtc)
    .not('status', 'eq', 'cancelled')

  if (apptErr) throw new Error(apptErr.message)

  const groupIds = [...new Set((apptRows ?? []).map((r: Record<string, unknown>) => r.group_id as string))]

  if (!groupIds.length) return { data: [], total: 0 }

  const from = (opts.page - 1) * opts.pageSize
  const { data, count, error } = await sb
    .from('appointment_groups')
    .select(GROUP_FIELDS, { count: 'exact' })
    .eq('tenant_id', tenantId)
    .in('id', groupIds)
    .order('created_at', { ascending: false })
    .range(from, from + opts.pageSize - 1)

  if (error) throw new Error(error.message)

  return {
    data: (data ?? []).map((r) => mapAppointmentGroup(r as unknown as Record<string, unknown>)),
    total: count ?? 0,
  }
}

export const appointmentGroupsApi = {
  async list(
    sb: SupabaseClient,
    tenantId: string,
    opts: {
      page: number
      pageSize: number
      filter: GroupFilter
      tz: string
    },
  ): Promise<{ data: AppointmentGroup[]; total: number }> {
    if (opts.filter === 'today' || opts.filter === 'week') {
      return listByDate(sb, tenantId, { ...opts, filter: opts.filter })
    }

    let q = sb
      .from('appointment_groups')
      .select(GROUP_FIELDS, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (opts.filter === 'new') q = q.eq('status', 'new')
    else if (opts.filter === 'archive') q = q.in('status', ['done', 'cancelled'])

    const from = (opts.page - 1) * opts.pageSize

    q = q.range(from, from + opts.pageSize - 1)

    const { data, count, error } = await q

    if (error) throw new Error(error.message)

    return {
      data: (data ?? []).map((r) => mapAppointmentGroup(r as unknown as Record<string, unknown>)),
      total: count ?? 0,
    }
  },

  async loadByIdWithAppointments(
    sb: SupabaseClient,
    id: string,
  ): Promise<{ group: AppointmentGroup | null; appointments: Appointment[] }> {
    const [groupRes, apptRes] = await Promise.all([
      sb.from('appointment_groups').select('*').eq('id', id).maybeSingle(),
      sb.from('appointments').select('*').eq('group_id', id).order('starts_at'),
    ])

    if (groupRes.error) throw new Error(groupRes.error.message)
    if (apptRes.error) throw new Error(apptRes.error.message)

    return {
      group: groupRes.data ? mapAppointmentGroup(groupRes.data as Record<string, unknown>) : null,
      appointments: (apptRes.data ?? []).map((r) => mapAppointment(r as Record<string, unknown>)),
    }
  },

  async batchLoadAppointmentDetails(
    sb: SupabaseClient,
    groupIds: string[],
  ): Promise<Map<string, { servicesList: string[]; firstStartsAt: string | null }>> {
    if (!groupIds.length) return new Map()

    const { data, error } = await sb
      .from('appointments')
      .select('group_id, service_name, starts_at')
      .in('group_id', groupIds)
      .order('starts_at')

    if (error) throw new Error(error.message)

    const result = new Map<string, { servicesList: string[]; firstStartsAt: string | null }>()

    for (const groupId of groupIds) {
      result.set(groupId, { servicesList: [], firstStartsAt: null })
    }

    for (const row of (data ?? []) as Array<{ group_id: string; service_name: string | null; starts_at: string }>) {
      const entry = result.get(row.group_id)

      if (!entry) continue
      if (row.service_name && !entry.servicesList.includes(row.service_name)) {
        entry.servicesList.push(row.service_name)
      }
      if (!entry.firstStartsAt) {
        entry.firstStartsAt = row.starts_at
      }
    }

    return result
  },

  async loadGroupViewData(
    sb: SupabaseClient,
    id: string,
  ): Promise<{
    group: AppointmentGroup | null
    appointments: Appointment[]
    resources: Resource[]
    events: AppointmentEvent[]
  }> {
    const [groupRes, apptRes] = await Promise.all([
      sb.from('appointment_groups').select('*').eq('id', id).maybeSingle(),
      sb.from('appointments').select('*').eq('group_id', id).order('starts_at'),
    ])

    if (groupRes.error) throw new Error(groupRes.error.message)
    if (apptRes.error) throw new Error(apptRes.error.message)

    const group = groupRes.data ? mapAppointmentGroup(groupRes.data as Record<string, unknown>) : null
    const appointments = (apptRes.data ?? []).map((r) => mapAppointment(r as Record<string, unknown>))

    if (!group) return { group: null, appointments: [], resources: [], events: [] }

    const resourceIds = [...new Set(
      appointments.map((a) => a.resourceId).filter((rid): rid is string => rid !== null),
    )]
    const apptIds = appointments.map((a) => a.id)

    const [resourcesRes, eventsRes] = await Promise.all([
      resourceIds.length
        ? sb.from('resources').select('*').in('id', resourceIds)
        : Promise.resolve({ data: [], error: null }),
      apptIds.length
        ? sb.from('appointment_events').select('*').in('appointment_id', apptIds).order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ])

    if (resourcesRes.error) throw new Error(resourcesRes.error.message)
    if (eventsRes.error) throw new Error(eventsRes.error.message)

    return {
      group,
      appointments,
      resources: (resourcesRes.data ?? []).map((r) => mapResource(r as Record<string, unknown>)),
      events: (eventsRes.data ?? []).map((r) => mapAppointmentEvent(r as Record<string, unknown>)),
    }
  },

  /**
   * Обновляет метаданные группы (клиент/филиал/примечание) одним UPDATE.
   * Поля appointments не трогаются — для слотов используй
   * `appointments.reschedule` / `addToGroup` / `cancel`.
   */
  async updateMeta(
    sb: SupabaseClient,
    id: string,
    payload: {
      customerName?: string
      customerPhone?: string
      customerEmail?: string | null
      notes?: string | null
      branchId?: string | null
      requestId?: string | null
    },
  ): Promise<void> {
    const p: Record<string, unknown> = {}

    if (payload.customerName !== undefined) p.customer_name = payload.customerName
    if (payload.customerPhone !== undefined) p.customer_phone = payload.customerPhone
    if (payload.customerEmail !== undefined) p.customer_email = payload.customerEmail
    if (payload.notes !== undefined) p.notes = payload.notes
    if (payload.branchId !== undefined) p.branch_id = payload.branchId
    if (payload.requestId !== undefined) p.request_id = payload.requestId

    if (Object.keys(p).length === 0) return

    const { error } = await sb
      .from('appointment_groups')
      .update(p)
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  /**
   * Создаёт группу со списком appointments одним RPC `create_appointments_bulk`.
   * Используется админкой при ручном создании записи через редактор.
   * Источник по умолчанию 'admin'; при конвертации заявки в группу — 'request'.
   * autoConfirm маппится в status 'confirmed' / 'new'.
   */
  async createBulk(
    sb: SupabaseClient,
    payload: {
      tenantId: string
      branchId: string | null
      customerId: string | null
      customerName: string
      customerPhone: string
      customerEmail: string | null
      notes: string | null
      items: Array<{
        serviceId: string
        resourceId: string | null
        startsAt: string
        endsAt: string
        serviceName: string
        servicePrice: number
      }>
      autoConfirm?: boolean
      allowReschedule?: boolean
      allowCancel?: boolean
      source?: 'admin' | 'request'
    },
  ): Promise<{
    groupId: string
    appointments: Array<{ id: string; serviceId: string; startsAt: string; endsAt: string }>
  }> {
    const rpcItems = payload.items.map((it) => ({
      service_id: it.serviceId,
      resource_id: it.resourceId,
      starts_at: it.startsAt,
      ends_at: it.endsAt,
      service_name: it.serviceName,
      service_price: it.servicePrice,
    }))

    const { data, error } = await sb.rpc('create_appointments_bulk', {
      p_tenant_id: payload.tenantId,
      p_branch_id: payload.branchId,
      p_user_id: null,
      p_customer_id: payload.customerId,
      p_customer_name: payload.customerName,
      p_customer_phone: payload.customerPhone,
      p_customer_email: payload.customerEmail,
      p_status: payload.autoConfirm ? 'confirmed' : 'new',
      p_notes: payload.notes,
      p_allow_reschedule_snapshot: payload.allowReschedule ?? false,
      p_allow_cancel_snapshot: payload.allowCancel ?? false,
      p_source: payload.source ?? 'admin',
      p_items: rpcItems,
    })

    if (error) throw new Error(error.message)

    type RpcResponse = {
      group_id: string
      appointments: Array<{ id: string; service_id: string; starts_at: string; ends_at: string }>
    }
    const parsed = data as RpcResponse | null

    if (!parsed?.group_id) throw new Error('create_appointments_bulk вернул некорректный ответ')

    return {
      groupId: parsed.group_id,
      appointments: (parsed.appointments ?? []).map((row) => ({
        id: row.id,
        serviceId: row.service_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      })),
    }
  },

  async countNew(sb: SupabaseClient, tenantId: string): Promise<number> {
    const { count, error } = await sb
      .from('appointment_groups')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'new')

    if (error) throw new Error(error.message)

    return count ?? 0
  },

  async confirm(sb: SupabaseClient, id: string, confirmedBy: string): Promise<void> {
    const { error } = await sb
      .from('appointments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: confirmedBy,
      })
      .eq('group_id', id)
      .neq('status', 'cancelled')
      .neq('status', 'done')

    if (error) throw new Error(error.message)
  },

  async cancelAll(sb: SupabaseClient, id: string, reason: string | null): Promise<void> {
    const { error } = await sb
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'admin',
        cancel_reason: reason,
      })
      .eq('group_id', id)
      .neq('status', 'done')

    if (error) throw new Error(error.message)
  },
}
