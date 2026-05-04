import type { SupabaseClient } from '@supabase/supabase-js'
import type { Branch, BranchAddressData, BranchFormData } from '@fastio/shared'
import { query } from '~/utils/query'
import type { BranchRow } from './db-types'
import { filterDefined } from '~/utils/filterDefined'

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
    const { data: statuses } = await sb
      .from('order_statuses')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('group_type', ['new', 'in_progress'])

    if (!statuses || statuses.length === 0) return false

    const statusIds = statuses.map((s: { id: string }) => s.id)
    const { count } = await sb
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .in('status', statusIds)

    return (count ?? 0) > 0
  },
}
