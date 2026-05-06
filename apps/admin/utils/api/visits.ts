import type { SupabaseClient } from '@supabase/supabase-js'
import type { Visit, Appointment, Resource, AppointmentEvent, AppointmentStatus } from '@fastio/shared'
import { mapVisit, mapAppointment, mapResource, todayInTz, addDaysToDateStr } from '@fastio/shared'
import { mapAppointmentEvent } from './appointment-events'

export type VisitFilter = 'new' | 'today' | 'week' | 'archive' | 'all'

const VISIT_FIELDS = `
  id, tenant_id, branch_id, customer_id, customer_name, customer_phone, customer_email,
  notes, source, status, business_date, requested_services,
  processed_by, processed_at, created_at, updated_at
`.trim()

export const visitsApi = {
  /**
   * Список визитов под фильтр инбокса. Агрегатные статусы (есть ли new внутри
   * / только confirmed / cancelled) считаются в JS на основе
   * `batchLoadAppointmentDetails`. Здесь фильтруем только по датам/архиву;
   * «new»/«archive» дополнительно фильтруются на клиенте по агрегату.
   */
  async list(
    sb: SupabaseClient,
    tenantId: string,
    opts: {
      page: number
      pageSize: number
      filter: VisitFilter
      tz: string
    },
  ): Promise<{ data: Visit[]; total: number }> {
    let q = sb
      .from('appointment_groups')
      .select(VISIT_FIELDS, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (opts.filter === 'today' || opts.filter === 'week') {
      const todayStr = todayInTz(opts.tz)
      const endStr = opts.filter === 'today' ? addDaysToDateStr(todayStr, 1) : addDaysToDateStr(todayStr, 7)

      q = q.gte('business_date', todayStr).lt('business_date', endStr)
    }

    const from = (opts.page - 1) * opts.pageSize

    q = q.range(from, from + opts.pageSize - 1)

    const { data, count, error } = await q

    if (error) throw new Error(error.message)

    return {
      data: (data ?? []).map((r) => mapVisit(r as unknown as Record<string, unknown>)),
      total: count ?? 0,
    }
  },

  async loadByIdWithAppointments(
    sb: SupabaseClient,
    id: string,
  ): Promise<{ visit: Visit | null; appointments: Appointment[] }> {
    const [visitRes, apptRes] = await Promise.all([
      sb.from('appointment_groups').select('*').eq('id', id).maybeSingle(),
      sb.from('appointments').select('*').eq('group_id', id).is('deleted_at', null).order('starts_at'),
    ])

    if (visitRes.error) throw new Error(visitRes.error.message)
    if (apptRes.error) throw new Error(apptRes.error.message)

    return {
      visit: visitRes.data ? mapVisit(visitRes.data as Record<string, unknown>) : null,
      appointments: (apptRes.data ?? []).map((r) => mapAppointment(r as Record<string, unknown>)),
    }
  },

  /**
   * Возвращает Map<visitId, {servicesList, firstStartsAt, totalDurationMinutes, statusCounts}>
   * для пачки визитов. statusCounts учитывает все статусы включая cancelled —
   * агрегат для UI считается отдельно (см. useVisitsList).
   */
  async batchLoadAppointmentDetails(
    sb: SupabaseClient,
    visitIds: string[],
  ): Promise<Map<string, {
    servicesList: string[]
    firstStartsAt: string | null
    totalDurationMinutes: number
    statusCounts: Partial<Record<AppointmentStatus, number>>
  }>> {
    if (!visitIds.length) return new Map()

    const { data, error } = await sb
      .from('appointments')
      .select('group_id, service_name, starts_at, ends_at, status')
      .in('group_id', visitIds)
      .order('starts_at')

    if (error) throw new Error(error.message)

    const result = new Map<string, {
      servicesList: string[]
      firstStartsAt: string | null
      totalDurationMinutes: number
      statusCounts: Partial<Record<AppointmentStatus, number>>
    }>()

    for (const visitId of visitIds) {
      result.set(visitId, { servicesList: [], firstStartsAt: null, totalDurationMinutes: 0, statusCounts: {} })
    }

    for (const row of (data ?? []) as Array<{ group_id: string; service_name: string | null; starts_at: string; ends_at: string; status: AppointmentStatus }>) {
      // group_id — physical column в appointments, мапим к визиту по этому ключу.
      const entry = result.get(row.group_id)

      if (!entry) continue

      entry.statusCounts[row.status] = (entry.statusCounts[row.status] ?? 0) + 1

      // Отменённые услуги не попадают в визуальный список услуг и не считаются в длительности —
      // визит без них может быть «осколком», но строка инбокса должна показывать живое содержимое.
      if (row.status === 'cancelled') continue

      if (row.service_name && !entry.servicesList.includes(row.service_name)) {
        entry.servicesList.push(row.service_name)
      }
      if (!entry.firstStartsAt) {
        entry.firstStartsAt = row.starts_at
      }
      const mins = Math.round((new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60000)

      entry.totalDurationMinutes += mins
    }

    return result
  },

  async loadVisitViewData(
    sb: SupabaseClient,
    id: string,
  ): Promise<{
    visit: Visit | null
    appointments: Appointment[]
    resources: Resource[]
    events: AppointmentEvent[]
  }> {
    const [visitRes, apptRes] = await Promise.all([
      sb.from('appointment_groups').select('*').eq('id', id).maybeSingle(),
      sb.from('appointments').select('*').eq('group_id', id).is('deleted_at', null).order('starts_at'),
    ])

    if (visitRes.error) throw new Error(visitRes.error.message)
    if (apptRes.error) throw new Error(apptRes.error.message)

    const visit = visitRes.data ? mapVisit(visitRes.data as Record<string, unknown>) : null
    const appointments = (apptRes.data ?? []).map((r) => mapAppointment(r as Record<string, unknown>))

    if (!visit) return { visit: null, appointments: [], resources: [], events: [] }

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
      visit,
      appointments,
      resources: (resourcesRes.data ?? []).map((r) => mapResource(r as Record<string, unknown>)),
      events: (eventsRes.data ?? []).map((r) => mapAppointmentEvent(r as Record<string, unknown>)),
    }
  },

  /**
   * Обновляет метаданные визита (клиент/филиал/примечание) одним UPDATE.
   * Поля appointments не трогаются — для слотов используй
   * `appointments.reschedule` / `addToVisit` / `cancel`.
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
    },
  ): Promise<void> {
    const p: Record<string, unknown> = {}

    if (payload.customerName !== undefined) p.customer_name = payload.customerName
    if (payload.customerPhone !== undefined) p.customer_phone = payload.customerPhone
    if (payload.customerEmail !== undefined) p.customer_email = payload.customerEmail
    if (payload.notes !== undefined) p.notes = payload.notes
    if (payload.branchId !== undefined) p.branch_id = payload.branchId

    if (Object.keys(p).length === 0) return

    const { error } = await sb
      .from('appointment_groups')
      .update(p)
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  /**
   * Создаёт визит со списком appointments одним RPC `create_appointments_bulk`.
   * Используется админкой при ручном создании записи через редактор.
   * Источник по умолчанию 'admin'; при конвертации заявки в визит — 'request'.
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
        resourceAssignedBy?: 'client' | 'auto' | 'admin'
      }>
      autoConfirm?: boolean
      allowReschedule?: boolean
      allowCancel?: boolean
      source?: 'admin' | 'request'
    },
  ): Promise<{
    visitId: string
    appointments: Array<{ id: string; serviceId: string; startsAt: string; endsAt: string }>
  }> {
    const rpcItems = payload.items.map((it) => ({
      service_id: it.serviceId,
      resource_id: it.resourceId,
      starts_at: it.startsAt,
      ends_at: it.endsAt,
      service_name: it.serviceName,
      service_price: it.servicePrice,
      resource_assigned_by: it.resourceAssignedBy ?? null,
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

    // RPC возвращает БД-имя `group_id` — мапим к visitId на клиенте.
    type RpcResponse = {
      group_id: string
      appointments: Array<{ id: string; service_id: string; starts_at: string; ends_at: string }>
    }
    const parsed = data as RpcResponse | null

    if (!parsed?.group_id) throw new Error('create_appointments_bulk вернул некорректный ответ')

    return {
      visitId: parsed.group_id,
      appointments: (parsed.appointments ?? []).map((row) => ({
        id: row.id,
        serviceId: row.service_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      })),
    }
  },

  /**
   * Счётчик «требует обработки» в инбокс-бейдже:
   *   - request-визиты (заявки от клиента, ждут оформления);
   *   - active-визиты с хотя бы одной услугой в статусе 'new'.
   */
  async countNew(sb: SupabaseClient, tenantId: string): Promise<number> {
    const [{ count: requestCount, error: reqErr }, { data: pendingRows, error: apptErr }] = await Promise.all([
      sb
        .from('appointment_groups')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'request'),
      sb
        .from('appointments')
        .select('group_id, appointment_groups!inner(tenant_id, status)')
        .eq('appointment_groups.tenant_id', tenantId)
        .eq('appointment_groups.status', 'active')
        .eq('status', 'new'),
    ])

    if (reqErr) throw new Error(reqErr.message)
    if (apptErr) throw new Error(apptErr.message)

    const pendingActiveIds = new Set((pendingRows ?? []).map((r: { group_id: string }) => r.group_id))

    return (requestCount ?? 0) + pendingActiveIds.size
  },

  /**
   * Подтверждает все non-cancelled/non-done услуги визита одним UPDATE.
   * Триггер enforce_visit_business_date на статус не реагирует, инвариант не страдает.
   */
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
    // Active-визит: отменяем все его non-done услуги. Параллельно ставим
    // visit.status='cancelled' (для UI агрегата). Cancelled-визит без active
    // услуг — просто чистый archive.
    const { error: apptErr } = await sb
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'admin',
        cancel_reason: reason,
      })
      .eq('group_id', id)
      .neq('status', 'done')

    if (apptErr) throw new Error(apptErr.message)

    const { error: visitErr } = await sb
      .from('appointment_groups')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (visitErr) throw new Error(visitErr.message)
  },

  /**
   * Перевод request-визита в 'cancelled' (бывший «Отклонить заявку»).
   * Проставляет processed_by/at для аудита.
   */
  async declineRequest(sb: SupabaseClient, id: string, processedBy: string): Promise<void> {
    const { error } = await sb
      .from('appointment_groups')
      .update({
        status: 'cancelled',
        processed_by: processedBy,
        processed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw new Error(error.message)
  },

  /**
   * Атомарный перенос всех активных услуг визита на новую дату — один RPC под
   * advisory lock. Времена и ресурсы остаются прежними (сдвиг по календарной
   * дате с учётом TZ). Если нужно изменить слоты — отдельный reschedule после.
   */
  async moveVisitToDate(
    sb: SupabaseClient,
    visitId: string,
    newDate: string,
    userId: string | null,
  ): Promise<{ newVisitId: string | null; movedAppointments: Array<{ id: string; startsAt: string; endsAt: string }>; noop: boolean }> {
    const { data, error } = await sb.rpc('move_visit_to_date', {
      p_visit_id: visitId,
      p_new_date: newDate,
      p_user_id: userId,
    })

    if (error) throw new Error(error.message)

    type RpcMoved = { id: string; starts_at: string; ends_at: string }
    const parsed = data as {
      new_visit_id?: string | null
      moved_appointments?: RpcMoved[]
      noop?: boolean
    } | null

    return {
      newVisitId: parsed?.new_visit_id ?? null,
      movedAppointments: (parsed?.moved_appointments ?? []).map((m) => ({
        id: m.id,
        startsAt: m.starts_at,
        endsAt: m.ends_at,
      })),
      noop: parsed?.noop ?? false,
    }
  },

  /**
   * Разделяет визит: указанные услуги отменяются в этом визите и появляются
   * как requested_services в новом request-визите того же клиента. Дату/слоты
   * новой заявки менеджер выберет на её странице.
   */
  async splitToRequest(
    sb: SupabaseClient,
    visitId: string,
    appointmentIds: string[],
    userId: string,
  ): Promise<{ newVisitId: string; movedCount: number }> {
    const { data, error } = await sb.rpc('split_visit_to_request', {
      p_visit_id: visitId,
      p_appointment_ids: appointmentIds,
      p_user_id: userId,
    })

    if (error) throw new Error(error.message)

    const parsed = data as { new_visit_id?: string; moved_count?: number } | null

    if (!parsed?.new_visit_id) throw new Error('split_visit_to_request вернул некорректный ответ')

    return { newVisitId: parsed.new_visit_id, movedCount: parsed.moved_count ?? 0 }
  },

  /**
   * Превращает request-визит в active: проставляет business_date, status,
   * processed_*, INSERT'ает appointments. Атомарный capacity-чек внутри RPC.
   */
  async convertRequest(
    sb: SupabaseClient,
    visitId: string,
    userId: string,
    items: Array<{
      serviceId: string
      resourceId: string | null
      startsAt: string
      endsAt: string
      serviceName: string
      servicePrice: number
      resourceAssignedBy?: 'client' | 'auto' | 'admin'
    }>,
  ): Promise<{ visitId: string; appointments: Array<{ id: string; serviceId: string; startsAt: string; endsAt: string }> }> {
    const rpcItems = items.map((it) => ({
      service_id: it.serviceId,
      resource_id: it.resourceId,
      starts_at: it.startsAt,
      ends_at: it.endsAt,
      service_name: it.serviceName,
      service_price: it.servicePrice,
      resource_assigned_by: it.resourceAssignedBy ?? null,
    }))

    const { data, error } = await sb.rpc('convert_visit_request', {
      p_visit_id: visitId,
      p_user_id: userId,
      p_items: rpcItems,
    })

    if (error) throw new Error(error.message)

    type RpcResponse = {
      visit_id: string
      appointments: Array<{ id: string; service_id: string; starts_at: string; ends_at: string }>
    }
    const parsed = data as RpcResponse | null

    if (!parsed?.visit_id) throw new Error('convert_visit_request вернул некорректный ответ')

    return {
      visitId: parsed.visit_id,
      appointments: (parsed.appointments ?? []).map((row) => ({
        id: row.id,
        serviceId: row.service_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      })),
    }
  },
}
