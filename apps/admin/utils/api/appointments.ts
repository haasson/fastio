import type { SupabaseClient } from '@supabase/supabase-js'
import type { Appointment, AppointmentStatus, AppointmentFormData } from '@fastio/shared'
import { mapAppointment, localDateTimeToUtcIso, addDaysToDateStr, DEFAULT_TIMEZONE } from '@fastio/shared'
import type { AppointmentRow } from '~/utils/api/db-types'
import { query } from '~/utils/query'

const FIELDS = `
  id, tenant_id, branch_id, service_id, service_name, service_price, resource_id, user_id,
  customer_name, customer_phone,
  starts_at, ends_at, actual_ends_at, booking_mode, status, resource_assigned_by, notes,
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
    // Используем RPC вместо прямого INSERT — appointments.group_id NOT NULL,
    // create_appointment создаёт группу из 1 элемента автоматически.
    //
    // RPC возвращает только {id} → второй SELECT нужен для маппинга в полный
    // Appointment. Это +1 round-trip; не критично (одиночный create — не hot path).
    // Когда соберёмся переписывать create_appointment — поменяем на RETURNS jsonb
    // как у create_appointments_bulk и уберём SELECT. См. TECHDEBT.md.
    const { data: rpcRows, error: rpcError } = await sb.rpc('create_appointment', {
      p_tenant_id: tenantId,
      p_branch_id: form.branchId ?? null,
      p_service_id: form.serviceId,
      p_resource_id: form.resourceId ?? null,
      p_user_id: null,
      p_customer_id: null,
      p_customer_name: form.customerName,
      p_customer_phone: form.customerPhone,
      p_starts_at: form.startsAt,
      p_ends_at: form.endsAt,
      p_status: (form.status ?? 'new') as AppointmentStatus,
      p_notes: form.notes ?? null,
      p_allow_reschedule_snapshot: false,
      p_allow_cancel_snapshot: false,
      p_service_name: form.serviceName,
      p_service_price: form.servicePrice,
      p_customer_email: null,
      p_source: 'admin',
    })

    if (rpcError) throw new Error(rpcError.message)

    const created = (rpcRows as Array<{ id: string }>)?.[0]

    if (!created?.id) throw new Error('create_appointment returned no row')

    const result = await query(
      sb.from('appointments').select(FIELDS).eq('id', created.id).single(),
    )

    return mapAppointment(result as unknown as AppointmentRow)
  },

  /**
   * Добавляет одно appointment в существующий визит через RPC
   * `add_service_to_visit` (capacity-чек + advisory lock).
   * Используется редактором визита при добавлении услуги в edit-mode.
   */
  async addToVisit(
    sb: SupabaseClient,
    payload: {
      visitId: string
      serviceId: string
      resourceId: string | null
      startsAt: string
      endsAt: string
      serviceName: string
      servicePrice: number
      status?: AppointmentStatus
      resourceAssignedBy?: 'client' | 'auto' | 'admin'
    },
  ): Promise<{ id: string }> {
    const { data, error } = await sb.rpc('add_service_to_visit', {
      p_visit_id: payload.visitId,
      p_service_id: payload.serviceId,
      p_resource_id: payload.resourceId,
      p_starts_at: payload.startsAt,
      p_ends_at: payload.endsAt,
      p_service_name: payload.serviceName,
      p_service_price: payload.servicePrice,
      p_status: payload.status ?? 'new',
      p_resource_assigned_by: payload.resourceAssignedBy ?? null,
    })

    if (error) throw new Error(error.message)

    const row = data as { id?: string } | null

    if (!row?.id) throw new Error('add_service_to_visit вернул некорректный ответ')

    return { id: row.id }
  },

  /**
   * Меняет слот/исполнителя/снапшот услуги через RPC `update_appointment`
   * (capacity-чек + advisory lock). Используется редактором визита
   * для существующих appointments. Поля customer_, notes, status, group_id
   * этим RPC не трогаются — для них есть `visits.updateMeta`
   * и отдельные status-переходы.
   */
  async reschedule(
    sb: SupabaseClient,
    id: string,
    payload: {
      resourceId: string | null
      startsAt: string
      endsAt: string
      serviceId?: string | null
      serviceName?: string | null
      servicePrice?: number | null
      resourceAssignedBy?: 'client' | 'auto' | 'admin'
    },
  ): Promise<void> {
    const { error } = await sb.rpc('update_appointment', {
      p_id: id,
      p_resource_id: payload.resourceId,
      p_starts_at: payload.startsAt,
      p_ends_at: payload.endsAt,
      p_service_id: payload.serviceId ?? null,
      p_service_name: payload.serviceName ?? null,
      p_service_price: payload.servicePrice ?? null,
      p_resource_assigned_by: payload.resourceAssignedBy ?? null,
    })

    if (error) throw new Error(error.message)
  },

  /**
   * Атомарный перенос записи через RPC `move_appointment`. Если новая business_date
   * совпадает с текущей — обычный reschedule. Если нет — RPC находит/создаёт
   * целевой визит того же tenant+branch+customer на новую дату и перевешивает
   * group_id. Опустевший старый визит удаляется.
   */
  async move(
    sb: SupabaseClient,
    id: string,
    payload: {
      startsAt: string
      endsAt: string
      resourceId: string | null
      serviceId?: string | null
      resourceAssignedBy?: 'client' | 'auto' | 'admin'
    },
  ): Promise<{ id: string; visitId: string; visitChanged: boolean; oldVisitId: string | null }> {
    const { data, error } = await sb.rpc('move_appointment', {
      p_appt_id: id,
      p_starts_at: payload.startsAt,
      p_ends_at: payload.endsAt,
      p_resource_id: payload.resourceId,
      p_service_id: payload.serviceId ?? null,
      p_resource_assigned_by: payload.resourceAssignedBy ?? null,
    })

    if (error) throw new Error(error.message)

    const r = data as {
      id: string
      visit_id: string
      visit_changed: boolean
      old_visit_id?: string | null
    } | null

    if (!r?.id) throw new Error('move_appointment вернул некорректный ответ')

    return {
      id: r.id,
      visitId: r.visit_id,
      visitChanged: !!r.visit_changed,
      oldVisitId: r.old_visit_id ?? null,
    }
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

  // Soft-delete: услуга физически убирается из визита (скрыта из UI), запись
  // остаётся для аудита/восстановления. Отдельно от cancel — последний это
  // бизнес-отмена визита целиком, видна клиенту в ЛК.
  async softDelete(sb: SupabaseClient, id: string, reason?: string, deletedBy?: string): Promise<void> {
    await query(
      sb.from('appointments').update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy ?? 'admin',
        deleted_reason: reason ?? null,
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

}
