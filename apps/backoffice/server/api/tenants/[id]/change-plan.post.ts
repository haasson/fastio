import { defineEventHandler, createError, readBody, getRouterParam } from 'h3'
import { getPlanTierOrder } from '@fastio/shared'
import { getAdminClient } from '../../../utils/adminClient'

const ACTIVE_ORDER_STATUS_GROUPS = ['completed', 'cancelled']

// Backoffice без Sentry-хелпера (см. health.get.ts) — логируем в console.error
// (видно в Coolify logs) и проваливаемся «закрыто»: если не смогли проверить
// блокер, НЕ разрешаем даунгрейд (500), иначе count=undefined → `?? 0` тихо
// пропустил бы активные заказы/столы/брони и тариф понизился бы вопреки им.
const blockerCheckFailed = (error: { message: string }, scope: string): never => {
  console.error(`[change-plan] blocker check «${scope}» failed:`, error.message)
  throw createError({ statusCode: 500, message: 'Не удалось проверить ограничения тарифа перед сменой' })
}

async function checkDowngradeBlockers(
  supabase: ReturnType<typeof getAdminClient>,
  tenantId: string,
  currentPlanKey: string,
  newPlanKey: string,
  modules: Record<string, boolean>,
): Promise<string | null> {
  const currentOrder = getPlanTierOrder(currentPlanKey)
  const newOrder = getPlanTierOrder(newPlanKey)

  if (newOrder >= currentOrder) return null

  const { data: moduleConfigs, error: moduleConfigsError } = await supabase
    .from('module_configs')
    .select('key, name, required_plan_key')
    .eq('is_active', true)

  if (moduleConfigsError) blockerCheckFailed(moduleConfigsError, 'module_configs')

  const losingModules = (moduleConfigs ?? []).filter((cfg) => {
    const cfgOrder = getPlanTierOrder(cfg.required_plan_key)

    return modules[cfg.key] === true && cfgOrder > newOrder
  })

  const losingKeys = new Set(losingModules.map((m) => m.key))

  // Active order statuses
  const getActiveStatusIds = async () => {
    const { data: statuses, error: statusesError } = await supabase
      .from('order_statuses')
      .select('id, group_type')
      .eq('tenant_id', tenantId)

    if (statusesError) blockerCheckFailed(statusesError, 'order_statuses')

    return (statuses ?? [])
      .filter((s) => !ACTIVE_ORDER_STATUS_GROUPS.includes(s.group_type))
      .map((s) => s.id)
  }

  if (losingKeys.has('delivery') || losingKeys.has('pickup')) {
    const statusIds = await getActiveStatusIds()

    if (statusIds.length) {
      const types = [
        ...(losingKeys.has('delivery') ? ['delivery'] : []),
        ...(losingKeys.has('pickup') ? ['pickup'] : []),
      ]
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status_id', statusIds)
        .in('delivery_type', types)

      if (error) blockerCheckFailed(error, 'orders')

      if ((count ?? 0) > 0) {
        return `Нельзя понизить тариф: есть активные заказы (${count}). Завершите или отмените их в разделе Заказы.`
      }
    }
  }

  if (losingKeys.has('dineIn')) {
    const { count: openTables, error: tablesError } = await supabase
      .from('tables')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_open', true)

    if (tablesError) blockerCheckFailed(tablesError, 'tables')

    if ((openTables ?? 0) > 0) {
      return `Нельзя понизить тариф: есть открытые столы (${openTables}). Закройте их в разделе Столы.`
    }

    // Брони — часть модуля «Столы»: потеря dineIn гасит и их.
    const { count: activeReservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'confirmed'])

    if (reservationsError) blockerCheckFailed(reservationsError, 'reservations')

    if ((activeReservations ?? 0) > 0) {
      return `Нельзя понизить тариф: есть активные бронирования (${activeReservations}). Завершите или отмените их.`
    }
  }

  if (losingKeys.has('kitchen')) {
    const { count, error } = await supabase
      .from('kitchen_queue')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('completed_at', null)

    if (error) blockerCheckFailed(error, 'kitchen_queue')

    if ((count ?? 0) > 0) {
      return `Нельзя понизить тариф: в очереди кухни есть незавершённые позиции (${count}).`
    }
  }

  if (losingKeys.has('customRoles')) {
    const { count, error } = await supabase
      .from('tenant_members')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('role_id', 'is', null)

    if (error) blockerCheckFailed(error, 'tenant_members')

    if ((count ?? 0) > 0) {
      return `Нельзя понизить тариф: у ${count} сотрудников назначены кастомные роли. Переведите их на стандартные роли.`
    }
  }

  return null
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) throw createError({ statusCode: 400, message: 'Missing tenant id' })

  const body = await readBody(event)

  if (!body.plan_key) throw createError({ statusCode: 400, message: 'Missing plan_key' })

  const supabase = getAdminClient()

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('subscription, modules')
    .eq('id', id)
    .single()

  // PGRST116 — «no rows»: легитимный 404. Иная ошибка — сбой БД, не выдаём 404
  // (это маскировало бы инцидент под «тенант не найден»).
  if (tenantError && tenantError.code !== 'PGRST116') {
    console.error('[change-plan] tenant lookup failed:', tenantError.message)
    throw createError({ statusCode: 500, message: 'Не удалось загрузить тенанта' })
  }
  if (!tenant) throw createError({ statusCode: 404, message: 'Tenant not found' })

  const currentPlanKey = tenant.subscription?.plan ?? ''
  const modules = (tenant.modules ?? {}) as Record<string, boolean>

  const blocker = await checkDowngradeBlockers(supabase, id, currentPlanKey, body.plan_key, modules)

  if (blocker) throw createError({ statusCode: 422, message: blocker })

  const { data, error } = await supabase.rpc('billing_change_plan', {
    p_tenant_id: id,
    p_new_plan_key: body.plan_key,
    p_user_id: null,
  })

  if (error) {
    console.error('[change-plan] billing_change_plan RPC failed:', error.message)
    throw createError({ statusCode: error.code === 'P0001' ? 422 : 500, message: error.message })
  }

  return { result: data }
})
