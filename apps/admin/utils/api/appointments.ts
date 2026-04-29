import type { SupabaseClient } from '@supabase/supabase-js'
import type { Appointment, AppointmentStatus, AppointmentFormData } from '@fastio/shared'
import { mapAppointment, localDateTimeToUtcIso, addDaysToDateStr, DEFAULT_TIMEZONE } from '@fastio/shared'
import type { AppointmentRow } from '~/utils/api/db-types'
import { query } from '~/utils/query'

const FIELDS = `
  id, tenant_id, branch_id, service_id, service_name, service_price, resource_id, user_id,
  customer_name, customer_phone,
  starts_at, ends_at, actual_ends_at, status, notes,
  cancel_reason, cancelled_by, cancelled_at,
  confirmed_at, confirmed_by,
  created_at, updated_at
`.trim()

export const appointmentsApi = {
  async listForDay(
    sb: SupabaseClient,
    tenantId: string,
    date: string,
    opts?: { branchId?: string; resourceId?: string; timezone?: string },
  ): Promise<Appointment[]> {
    const tz = opts?.timezone ?? DEFAULT_TIMEZONE
    const dayStartUtc = localDateTimeToUtcIso(date, '00:00', tz)
    const dayEndUtc = localDateTimeToUtcIso(addDaysToDateStr(date, 1), '00:00', tz)

    let q = sb
      .from('appointments')
      .select(FIELDS)
      .eq('tenant_id', tenantId)
      .gte('starts_at', dayStartUtc)
      .lt('starts_at', dayEndUtc)
      .not('status', 'eq', 'cancelled')
      .order('starts_at')

    if (opts?.branchId) q = q.eq('branch_id', opts.branchId)
    if (opts?.resourceId) q = q.eq('resource_id', opts.resourceId)

    const data = await query(q)

    return (data ?? []).map((r) => mapAppointment(r as unknown as AppointmentRow))
  },

  async listPaginated(
    sb: SupabaseClient,
    tenantId: string,
    opts: {
      statuses?: AppointmentStatus[]
      branchId?: string
      resourceId?: string
      serviceId?: string
      search?: string
      dateFrom?: string
      dateTo?: string
      sortDir?: 'asc' | 'desc'
      page: number
      pageSize: number
    },
  ): Promise<{ data: Appointment[]; total: number }> {
    let q = sb
      .from('appointments')
      .select(FIELDS, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('starts_at', { ascending: opts.sortDir === 'asc' })

    if (opts.statuses?.length) q = q.in('status', opts.statuses)
    if (opts.branchId) q = q.eq('branch_id', opts.branchId)
    if (opts.resourceId) q = q.eq('resource_id', opts.resourceId)
    if (opts.serviceId) q = q.eq('service_id', opts.serviceId)
    if (opts.dateFrom) q = q.gte('starts_at', opts.dateFrom)
    if (opts.dateTo) q = q.lt('starts_at', opts.dateTo)
    if (opts.search) {
      // PostgREST `.or()` парсит запятую как разделитель условий, скобки — как
      // группировку. Юзер мог ввести «Иванов, Иван» или «(902) 123-45-67» —
      // без чистки запрос ломается. Плюс LIKE-метасимволы `%` / `_` тоже надо
      // экранировать, чтобы не считать их wildcards.
      const s = opts.search
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_')
        .replace(/[,()]/g, ' ')
        .trim()

      if (s) q = q.or(`customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`)
    }

    const from = (opts.page - 1) * opts.pageSize

    q = q.range(from, from + opts.pageSize - 1)

    const { data, count, error } = await q

    if (error) throw new Error(error.message)

    return { data: (data ?? []).map((r) => mapAppointment(r as unknown as AppointmentRow)), total: count ?? 0 }
  },

  async create(sb: SupabaseClient, tenantId: string, form: AppointmentFormData & { endsAt: string; status?: AppointmentStatus; serviceName: string; servicePrice: number }): Promise<Appointment> {
    const result = await query(
      sb.from('appointments').insert({
        tenant_id: tenantId,
        branch_id: form.branchId ?? null,
        service_id: form.serviceId,
        service_name: form.serviceName,
        service_price: form.servicePrice,
        resource_id: form.resourceId ?? null,
        customer_name: form.customerName,
        customer_phone: form.customerPhone,
        starts_at: form.startsAt,
        ends_at: form.endsAt,
        status: form.status ?? 'new',
        notes: form.notes ?? null,
      }).select(FIELDS).single(),
    )

    return mapAppointment(result as unknown as AppointmentRow)
  },

  async confirm(sb: SupabaseClient, id: string, confirmedBy: string): Promise<Appointment> {
    const result = await query(
      sb.from('appointments').update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        confirmed_by: confirmedBy,
      }).eq('id', id).select(FIELDS).single(),
    )

    return mapAppointment(result as unknown as AppointmentRow)
  },

  async cancel(sb: SupabaseClient, id: string, reason?: string, cancelledBy?: string): Promise<void> {
    await query(
      sb.from('appointments').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason ?? null,
        cancelled_by: cancelledBy ?? 'admin',
      }).eq('id', id),
    )
  },

  async markDone(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('appointments').update({ status: 'done' }).eq('id', id))
  },

  async update(sb: SupabaseClient, id: string, patch: Partial<{
    serviceId: string
    serviceName: string
    servicePrice: number
    resourceId: string | null
    branchId: string | null
    customerName: string
    customerPhone: string
    notes: string | null
    startsAt: string
    endsAt: string
    actualEndsAt: string | null
  }>): Promise<Appointment> {
    const p: Record<string, unknown> = {}

    if (patch.serviceId !== undefined) p.service_id = patch.serviceId
    if (patch.serviceName !== undefined) p.service_name = patch.serviceName
    if (patch.servicePrice !== undefined) p.service_price = patch.servicePrice
    if (patch.resourceId !== undefined) p.resource_id = patch.resourceId
    if (patch.branchId !== undefined) p.branch_id = patch.branchId
    if (patch.customerName !== undefined) p.customer_name = patch.customerName
    if (patch.customerPhone !== undefined) p.customer_phone = patch.customerPhone
    if (patch.notes !== undefined) p.notes = patch.notes
    if (patch.startsAt !== undefined) p.starts_at = patch.startsAt
    if (patch.endsAt !== undefined) p.ends_at = patch.endsAt
    if (patch.actualEndsAt !== undefined) p.actual_ends_at = patch.actualEndsAt

    const result = await query(
      sb.from('appointments').update(p).eq('id', id).select(FIELDS).single(),
    )

    return mapAppointment(result as unknown as AppointmentRow)
  },

  /**
   * Продлевает запись на N минут — для open_ended (бильярд, баня и т. п.).
   * Сдвигает actual_ends_at, если задан, иначе ends_at.
   */
  async extend(sb: SupabaseClient, id: string, minutes: number): Promise<Appointment> {
    const existing = await query(
      sb.from('appointments').select('ends_at, actual_ends_at').eq('id', id).single(),
    ) as { ends_at: string; actual_ends_at: string | null }

    const baseIso = existing.actual_ends_at ?? existing.ends_at
    const next = new Date(new Date(baseIso).getTime() + minutes * 60_000).toISOString()

    const result = await query(
      sb.from('appointments').update({ actual_ends_at: next }).eq('id', id).select(FIELDS).single(),
    )

    return mapAppointment(result as unknown as AppointmentRow)
  },

  /**
   * Закрывает open_ended запись «сейчас» — actual_ends_at = now().
   */
  async closeNow(sb: SupabaseClient, id: string): Promise<Appointment> {
    const result = await query(
      sb.from('appointments').update({ actual_ends_at: new Date().toISOString() }).eq('id', id).select(FIELDS).single(),
    )

    return mapAppointment(result as unknown as AppointmentRow)
  },
}
