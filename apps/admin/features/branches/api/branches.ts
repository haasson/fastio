import type { SupabaseClient } from '@supabase/supabase-js'
import type { Branch, BranchAddressData, BranchFormData } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import { reportError } from '@fastio/shared/observability'
import type { BranchRow } from '~/shared/data/db-types'
import { filterDefined } from '~/shared/utils/filterDefined'

export const mapBranch = (raw: Record<string, unknown>): Branch => {
  const row = raw as BranchRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    color: row.color,
    address: row.address,
    addressData: row.address_data as BranchAddressData,
    phone: row.phone,
    isActive: row.is_active,
    workingHoursSchedule: row.working_hours_schedule,
    deliveryMinOrder: row.delivery_min_order,
    deliveryFee: row.delivery_fee,
    notifications: row.notifications,
    latitude: row.latitude,
    longitude: row.longitude,
    orderNumberPrefix: row.order_number_prefix ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? null,
  }
}

/**
 * Сериализация формы в payload для БД. Поле `address_data` обязательно для
 * новых записей: CHECK-constraint в миграции 244 проверяет, что
 * address_data->>'value' = address.
 */
const branchToDb = (data: BranchFormData) => {
  validateAddressDataConsistency(data.address, data.addressData)

  return {
    name: data.name,
    color: data.color,
    address: data.address,
    address_data: data.addressData,
    phone: data.phone,
    is_active: data.isActive,
    working_hours_schedule: data.workingHoursSchedule,
    delivery_min_order: data.deliveryMinOrder,
    delivery_fee: data.deliveryFee,
    notifications: data.notifications,
    latitude: data.latitude,
    longitude: data.longitude,
    order_number_prefix: data.orderNumberPrefix ?? null,
  }
}

/**
 * Серверная страховка от обхода клиентской валидации. Если фронт отправил
 * address без address_data (или они рассинхронизированы) — это значит, что
 * пользователь не выбрал адрес из подсказок DaData. Бросаем явную ошибку
 * вместо опоры на CHECK constraint, чтобы текст в UI был осмысленным.
 */
function validateAddressDataConsistency(address: string, addressData: BranchAddressData): void {
  if (!addressData || typeof addressData.value !== 'string') {
    throw new Error('Адрес филиала должен быть выбран во всплывающей подсказке (отсутствует address_data)')
  }

  if (addressData.value !== address) {
    throw new Error('Адрес филиала должен быть выбран во всплывающей подсказке (address не совпадает с address_data.value)')
  }
}

export const branchesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<Branch[]> {
    const data = await query(
      sb.from('branches').select('*').eq('tenant_id', tenantId).is('archived_at', null).order('created_at'),
    )

    return (data ?? []).map(mapBranch)
  },

  async listArchived(sb: SupabaseClient, tenantId: string): Promise<Branch[]> {
    const data = await query(
      sb.from('branches').select('*').eq('tenant_id', tenantId).not('archived_at', 'is', null).order('archived_at', { ascending: false }),
    )

    return (data ?? []).map(mapBranch)
  },

  async add(sb: SupabaseClient, tenantId: string, data: BranchFormData): Promise<Branch | null> {
    const result = await query(
      sb.from('branches').insert({ tenant_id: tenantId, ...branchToDb(data) }).select().single(),
    )

    return result ? mapBranch(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<BranchFormData>): Promise<Branch | null> {
    // address и addressData идут только парой — нельзя поменять одно без другого,
    // иначе CHECK-constraint упадёт. Если хоть одно из двух пришло — должны быть оба.
    if (data.address !== undefined || data.addressData !== undefined) {
      if (data.address === undefined || data.addressData === undefined) {
        throw new Error('При обновлении адреса нужно передать и address, и addressData')
      }
      validateAddressDataConsistency(data.address, data.addressData)
    }

    const payload = filterDefined({
      name: data.name,
      color: data.color,
      address: data.address,
      address_data: data.addressData,
      phone: data.phone,
      is_active: data.isActive,
      working_hours_schedule: data.workingHoursSchedule,
      delivery_min_order: data.deliveryMinOrder,
      delivery_fee: data.deliveryFee,
      notifications: data.notifications,
      latitude: data.latitude,
      longitude: data.longitude,
      order_number_prefix: data.orderNumberPrefix,
    }) as Partial<BranchRow>

    const result = await query(sb.from('branches').update(payload).eq('id', id).select().single())

    return result ? mapBranch(result) : null
  },

  async archive(sb: SupabaseClient, id: string): Promise<Branch | null> {
    const result = await query(
      sb.from('branches').update({ archived_at: new Date().toISOString() }).eq('id', id).select().single(),
    )

    return result ? mapBranch(result) : null
  },

  async restore(sb: SupabaseClient, id: string): Promise<Branch | null> {
    const result = await query(
      sb.from('branches').update({ archived_at: null }).eq('id', id).select().single(),
    )

    return result ? mapBranch(result) : null
  },

  async hasActiveOrders(sb: SupabaseClient, branchId: string, tenantId: string): Promise<boolean> {
    const { data: statuses, error: statusesError } = await sb
      .from('order_statuses')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('group_type', ['new', 'in_progress'])

    if (statusesError) {
      reportError(statusesError, { context: 'branches.hasActiveOrders.statuses', branchId, tenantId })

      // Fail-safe: при ошибке считаем что есть активные — блокируем архивацию.
      // Парность с hasActiveReservations/hasActiveAppointments.
      return true
    }

    if (!statuses || statuses.length === 0) return false

    const statusIds = statuses.map((s: { id: string }) => s.id)
    const { count, error: ordersError } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .in('status', statusIds)
      .neq('delivery_type', 'dine_in')

    if (ordersError) {
      reportError(ordersError, { context: 'branches.hasActiveOrders.orders', branchId, tenantId })

      return true
    }

    return (count ?? 0) > 0
  },

  /**
   * Активные брони стола на этом филиале — сегодня позже текущего времени или
   * в будущем. Активные = status ∈ {pending, confirmed, seated}; completed/
   * cancelled/no_show фильтруются.
   *
   * Просрочка по времени учитывается через .or(): «сегодня и время бронирования
   * не наступило ИЛИ дата позже сегодня». Иначе бронь на сегодня 10:00 при
   * текущих 18:00 ложно блокировала бы архивацию.
   */
  async hasActiveReservations(sb: SupabaseClient, branchId: string, tenantId: string): Promise<boolean> {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const nowTime = now.toISOString().slice(11, 19) // HH:MM:SS (UTC; reserved_time хранится как локальная — допустимое приближение, см. ниже)

    const { count, error } = await sb
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .in('status', ['pending', 'confirmed', 'seated'])
      .or(`reserved_date.gt.${today},and(reserved_date.eq.${today},reserved_time.gte.${nowTime})`)

    if (error) {
      reportError(error, { context: 'branches.hasActiveReservations', branchId, tenantId })

      // Fail-safe: при ошибке считаем что есть активные — блокируем архивацию,
      // лучше ложно-положительный, чем потерять брони.
      return true
    }

    return (count ?? 0) > 0
  },

  /**
   * Активные записи на услуги на этом филиале в будущем (starts_at >= now).
   * Активные = status ∈ {new, confirmed}; cancelled/done фильтруются.
   * starts_at — timestamptz, сравниваем с текущим UTC-моментом.
   */
  async hasActiveAppointments(sb: SupabaseClient, branchId: string, tenantId: string): Promise<boolean> {
    const nowIso = new Date().toISOString()
    const { count, error } = await sb
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .in('status', ['new', 'confirmed'])
      .gte('starts_at', nowIso)

    if (error) {
      reportError(error, { context: 'branches.hasActiveAppointments', branchId, tenantId })

      // Fail-safe: при ошибке блокируем архивацию (см. hasActiveReservations).
      return true
    }

    return (count ?? 0) > 0
  },

  /**
   * Есть ли активные столы у этого филиала. Используется как guard при архивации:
   * архивация — это soft-update (archived_at = now()), который скрывает филиал из
   * активного набора (resolveDelivery фильтрует is_active + archived_at IS NULL).
   * Стол сохранит branch_id, но укажет на «исчезнувший» из рантайма филиал, и
   * dine-in заказы перестанут маршрутизироваться. FK ON DELETE RESTRICT защищает от
   * hard-delete; этот guard — от soft-archive.
   *
   * Fail-safe: при ошибке возвращаем true — блокируем архивацию (парность с
   * hasActiveReservations/hasActiveAppointments, см. PREPROD-020).
   */
  async hasTables(sb: SupabaseClient, branchId: string): Promise<boolean> {
    const { count, error } = await sb
      .from('tables')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('is_open', true)

    if (error) {
      reportError(error, { context: 'branches.hasTables', branchId })

      // Fail-safe: блокируем архивацию при ошибке (парность с hasActiveReservations).
      return true
    }

    return (count ?? 0) > 0
  },
}
