import type { SupabaseClient } from '@supabase/supabase-js'
import type { Reservation, ReservationFormData, ReservationStatus } from '@fastio/shared'
import { mapReservation } from '@fastio/shared'
import { query } from '~/utils/query'

const SELECT_FIELDS = `
  id, tenant_id, branch_id, customer_id,
  guest_name, guest_phone, guest_email, guest_count,
  reserved_date, reserved_time, comment, status,
  table_id, table_name,
  confirmed_by, confirmed_at, seated_at,
  cancelled_at, cancel_reason,
  created_at, updated_at
`.trim()

export { mapReservation }

export const reservationsApi = {
  async list(
    sb: SupabaseClient,
    tenantId: string,
    options?: { date?: string; statuses?: ReservationStatus[]; branchId?: string },
  ): Promise<Reservation[]> {
    let q = sb
      .from('reservations')
      .select(SELECT_FIELDS)
      .eq('tenant_id', tenantId)
      .order('reserved_date', { ascending: false })
      .order('reserved_time', { ascending: true })

    if (options?.date) q = q.eq('reserved_date', options.date)
    if (options?.statuses?.length) q = q.in('status', options.statuses)
    if (options?.branchId) q = q.eq('branch_id', options.branchId)

    const data = await query(q)

    return (data ?? []).map(mapReservation)
  },

  async getById(sb: SupabaseClient, id: string): Promise<Reservation | null> {
    const { data, error } = await sb
      .from('reservations')
      .select(SELECT_FIELDS)
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[reservations.getById]', error.message)

      return null
    }

    return data ? mapReservation(data) : null
  },

  async create(sb: SupabaseClient, tenantId: string, data: ReservationFormData): Promise<Reservation | null> {
    const result = await query(
      sb.from('reservations').insert({
        tenant_id: tenantId,
        guest_name: data.guestName,
        guest_phone: data.guestPhone,
        guest_email: data.guestEmail ?? null,
        guest_count: data.guestCount,
        reserved_date: data.reservedDate,
        reserved_time: data.reservedTime,
        comment: data.comment ?? null,
        branch_id: data.branchId ?? null,
      }).select(SELECT_FIELDS).single(),
    )

    return result ? mapReservation(result) : null
  },

  async update(sb: SupabaseClient, id: string, patch: Partial<Record<string, unknown>>): Promise<Reservation | null> {
    const result = await query(
      sb.from('reservations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select(SELECT_FIELDS).single(),
    )

    return result ? mapReservation(result) : null
  },

  async confirm(
    sb: SupabaseClient,
    id: string,
    tableId: string | null,
    tableName: string | null,
    confirmedBy: string,
  ): Promise<Reservation | null> {
    const result = await query(
      sb.from('reservations').update({
        status: 'confirmed',
        table_id: tableId,
        table_name: tableName,
        confirmed_by: confirmedBy,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id).select(SELECT_FIELDS).single(),
    )

    return result ? mapReservation(result) : null
  },

  async cancel(sb: SupabaseClient, id: string, reason?: string): Promise<void> {
    await query(
      sb.from('reservations').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      }).eq('id', id),
    )
  },

  async seat(sb: SupabaseClient, id: string): Promise<Reservation | null> {
    const result = await query(
      sb.from('reservations').update({
        status: 'seated',
        seated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id).select(SELECT_FIELDS).single(),
    )

    return result ? mapReservation(result) : null
  },

  async complete(sb: SupabaseClient, id: string): Promise<void> {
    await query(
      sb.from('reservations').update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', id),
    )
  },

  async listPaginated(
    sb: SupabaseClient,
    tenantId: string,
    options: {
      statuses: ReservationStatus[]
      branchId?: string
      date?: string
      search?: string
      guestMin?: number
      guestMax?: number
      page: number
      pageSize: number
    },
  ): Promise<{ data: Reservation[]; total: number }> {
    let q = sb
      .from('reservations')
      .select(SELECT_FIELDS, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .in('status', options.statuses)
      .order('reserved_date', { ascending: false })
      .order('reserved_time', { ascending: false })

    if (options.branchId) q = q.eq('branch_id', options.branchId)
    if (options.date) q = q.eq('reserved_date', options.date)
    if (options.search) {
      const s = options.search.replace(/%/g, '\\%').replace(/_/g, '\\_')

      q = q.or(`guest_name.ilike.%${s}%,guest_phone.ilike.%${s}%`)
    }
    if (options.guestMin !== undefined) q = q.gte('guest_count', options.guestMin)
    if (options.guestMax !== undefined) q = q.lte('guest_count', options.guestMax)

    const from = (options.page - 1) * options.pageSize

    q = q.range(from, from + options.pageSize - 1)

    const { data, count, error } = await q

    if (error) {
      console.error('[reservations.listPaginated]', error.message)
      throw new Error(error.message)
    }

    return {
      data: (data ?? []).map(mapReservation),
      total: count ?? 0,
    }
  },
}
