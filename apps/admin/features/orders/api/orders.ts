import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, OrderItem, OrderDeliveryType, OrderItemModifier, OrderItemAddon } from '@fastio/shared'
import { normalizePhone, orderItemKey } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import { sanitizeOrSearch } from '~/shared/utils/orFilter'
import { reportError } from '@fastio/shared/observability'
import type { OrderRow, OrderItemRow } from '~/shared/data/db-types'
import { filterDefined } from '~/shared/utils/filterDefined'

type RemoveItemEnvelope
  = | { ok: true; order_deleted?: boolean }
    | { ok: false; reason: 'not_found' | 'forbidden' }

const ORDER_SELECT = '*, order_items(*)' as const

export type OrderUpdateData = {
  customerName?: string
  customerPhone?: string
  customerEmail?: string | null
  items?: OrderItem[]
  deliveryType?: OrderDeliveryType
  address?: string | null
  entrance?: string | null
  floor?: string | null
  apartment?: string | null
  intercom?: string | null
  deliveryLat?: number | null
  deliveryLon?: number | null
  comment?: string | null
  promoCode?: string | null
  promotionId?: string | null
  discountAmount?: number
  subtotal?: number
  deliveryFee?: number
  total?: number
  status?: string
  paymentType?: 'cash' | 'card' | 'online'
  branchId?: string | null
  scheduledAt?: string | null
  kitchenLeadMinutes?: number | null
}

export type OrderCreateData = {
  tenantId: string
  branchId: string | null
  customerName: string | null
  customerPhone: string
  customerEmail?: string | null
  items: OrderItem[]
  deliveryType: OrderDeliveryType
  address: string | null
  entrance?: string | null
  floor?: string | null
  apartment?: string | null
  intercom?: string | null
  deliveryLat?: number | null
  deliveryLon?: number | null
  comment: string | null
  promoCode: string | null
  promotionId?: string | null
  discountAmount: number
  subtotal: number
  deliveryFee: number
  total: number
  status: string
  paymentType: 'cash' | 'card' | 'online'
  tableId?: string | null
  tableName?: string | null
  idempotencyKey?: string | null
  scheduledAt?: string | null
}

export type OrderFilter = string | null

const mapOrderItem = (row: OrderItemRow): OrderItem => ({
  id: row.id,
  orderId: row.order_id,
  dishId: row.dish_id,
  comboId: row.combo_id,
  dishName: row.dish_name,
  categoryName: row.category_name,
  price: row.price,
  quantity: row.quantity,
  removedIngredients: row.removed_ingredients ?? [],
  modifiers: row.modifiers ?? [],
  addons: row.addons ?? [],
  customizable: row.customizable ?? undefined,
  sortOrder: row.sort_order,
  completedAt: row.completed_at ?? null,
  comboItems: row.combo_items ?? null,
  addedBy: row.added_by ?? null,
  confirmedBy: row.confirmed_by ?? null,
  status: row.status ?? 'confirmed',
})

export const mapOrder = (raw: Record<string, unknown>): Order => {
  const row = raw as OrderRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? '',
    customerEmail: row.customer_email,
    items: (row.order_items ?? []).map(mapOrderItem),
    deliveryType: row.delivery_type,
    address: row.address,
    entrance: row.entrance ?? null,
    floor: row.floor ?? null,
    apartment: row.apartment ?? null,
    intercom: row.intercom ?? null,
    deliveryLat: row.delivery_lat ?? null,
    deliveryLon: row.delivery_lon ?? null,
    comment: row.comment,
    promoCode: row.promo_code,
    promotionId: row.promotion_id ?? null,
    discountAmount: row.discount_amount,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
    status: row.status,
    statusGroup: (raw as Record<string, unknown>).statusGroup as Order['statusGroup'] ?? null,
    statusName: (raw as Record<string, unknown>).statusName as string ?? null,
    paymentType: row.payment_type,
    needsChange: row.needs_change ?? false,
    changeFrom: row.change_from ?? null,
    branchId: row.branch_id,
    branchAddress: row.branch_address ?? null,
    deliveryZoneId: row.delivery_zone_id,
    tableId: row.table_id,
    tableName: row.table_name,
    orderNumber: row.order_number ?? null,
    acceptedBy: row.accepted_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    kitchenQueuedAt: row.kitchen_queued_at ?? null,
    kitchenCompletedAt: row.kitchen_completed_at ?? null,
    kitchenLeadMinutes: row.kitchen_lead_minutes ?? null,
    scheduledAt: row.scheduled_at ?? null,
    visitedStatuses: row.visited_statuses ?? [],
  }
}

const toOrderPayload = (data: OrderUpdateData | OrderCreateData): Partial<OrderRow> => filterDefined({
  customer_name: data.customerName,
  customer_phone: data.customerPhone,
  customer_email: data.customerEmail,
  delivery_type: data.deliveryType,
  address: data.address,
  entrance: data.entrance,
  floor: data.floor,
  apartment: data.apartment,
  intercom: data.intercom,
  delivery_lat: data.deliveryLat,
  delivery_lon: data.deliveryLon,
  comment: data.comment,
  promo_code: data.promoCode,
  ...(data.promotionId !== undefined && { promotion_id: data.promotionId }),
  discount_amount: data.discountAmount,
  subtotal: data.subtotal,
  delivery_fee: data.deliveryFee ?? 0,
  total: data.total,
  branch_id: data.branchId,
  status: data.status,
  payment_type: data.paymentType,
  scheduled_at: data.scheduledAt,
  ...('kitchenLeadMinutes' in data && { kitchen_lead_minutes: data.kitchenLeadMinutes }),
}) as Partial<OrderRow>

// orderId опционален: для INSERT в order_items нужен (см. createWithItems),
// для RPC update_order_with_items — нет (RPC игнорирует order_id из JSON,
// подставляет p_order_id). Возврат — Partial<...>, чтобы тип покрывал оба
// случая; конкретный потребитель сужает через cast при необходимости.
const toItemRows = (items: OrderItem[], orderId?: string): Partial<OrderItemRow>[] => items.map((item, i) => ({
  ...(orderId ? { order_id: orderId } : {}),
  dish_id: item.dishId,
  combo_id: item.comboId ?? null,
  dish_name: item.dishName,
  category_name: item.categoryName ?? null,
  price: item.price,
  quantity: item.quantity,
  removed_ingredients: item.removedIngredients,
  modifiers: item.modifiers ?? [],
  addons: item.addons ?? [],
  customizable: item.customizable ?? null,
  sort_order: i,
  completed_at: item.completedAt ?? null,
  combo_items: item.comboItems ?? null,
  added_by: item.addedBy ?? null,
  confirmed_by: item.confirmedBy ?? null,
  status: item.status ?? 'confirmed',
}))

export const DEFAULT_PAGE_SIZE = 10

const SORTABLE_COLUMNS = new Set(['created_at', 'total'])

export type TableSession = {
  id: string
  createdAt: string
  settledAt: string | null
  tableId: string | null
  tableName: string | null
  customerName: string | null
  customerPhone: string | null
  total: number
  subtotal: number
  discountAmount: number
  paymentType: 'cash' | 'card' | 'online' | null
  settledBy: string | null
  itemCount: number
  checkStatus: 'settled' | 'cancelled'
}

export type TableSessionsParams = {
  branchId: string | null
  date: string // YYYY-MM-DD — один день
  // Готовые ISO-границы суток. Если переданы — используются как есть (для
  // корректного учёта таймзоны тенанта на стороне вызывающего). Иначе границы
  // считаются из `date` как [date 00:00 UTC, date+1 00:00 UTC).
  from?: string
  to?: string
  tableId?: string
  search?: string // по customer_name / customer_phone
  minTotal?: number
  limit?: number
  offset?: number
}

export type TableSessionsResult = {
  sessions: TableSession[]
  total: number
}

const mapTableSession = (raw: Record<string, unknown>): TableSession => {
  const row = raw as OrderRow & { order_items?: { count: number }[] }

  return {
    id: row.id,
    createdAt: row.created_at,
    settledAt: row.settled_at ?? null,
    tableId: row.table_id,
    tableName: row.table_name,
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? null,
    total: row.total,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    paymentType: row.payment_type ?? null,
    settledBy: row.settled_by ?? null,
    itemCount: (row.order_items?.[0]?.count as number) ?? 0,
    checkStatus: row.check_status as 'settled' | 'cancelled',
  }
}

// Границы суток по дате YYYY-MM-DD: [from, to) полуинтервал.
// Если from/to не переданы — UTC-границы дня.
const dayBounds = (date: string, from?: string, to?: string): { from: string; to: string } => {
  if (from && to) return { from, to }

  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  return { from: start.toISOString(), to: end.toISOString() }
}

export type OrderListOptions = {
  branchId?: string | null
  filterBranchIds?: string[]
  page?: number
  pageSize?: number
  search?: string
  statusIds?: string[]
  deliveryTypes?: string[]
  excludeDeliveryTypes?: string[]
  paymentTypes?: string[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export const ordersApi = {
  async list(
    sb: SupabaseClient,
    tenantId: string,
    filter: string | null,
    options: OrderListOptions = {},
  ) {
    const {
      branchId = null,
      filterBranchIds = [],
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
      search,
      statusIds = [],
      deliveryTypes = [],
      excludeDeliveryTypes = [],
      paymentTypes = [],
      sortBy = 'created_at',
      sortDir = 'desc',
    } = options

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const safeSort = SORTABLE_COLUMNS.has(sortBy) ? sortBy : 'created_at'

    let q = sb
      .from('orders')
      .select(ORDER_SELECT, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order(safeSort, { ascending: sortDir === 'asc' })
      .range(from, to)

    if (statusIds.length > 0) {
      q = q.in('status', statusIds)
    } else if (filter) {
      q = q.eq('status', filter)
    }

    if (filterBranchIds.length > 0) {
      q = q.in('branch_id', filterBranchIds)
    } else if (branchId !== null) {
      q = q.eq('branch_id', branchId)
    }

    if (search) {
      const safe = sanitizeOrSearch(search)
      const phoneDigits = normalizePhone(search)
      const phonePart = phoneDigits.length >= 3
        ? `customer_phone.ilike.%${phoneDigits}%`
        : `customer_phone.ilike.%${safe}%`

      q = q.or(`customer_name.ilike.%${safe}%,${phonePart}`)
    }

    if (deliveryTypes.length > 0) {
      q = q.in('delivery_type', deliveryTypes)
    } else if (excludeDeliveryTypes.length > 0) {
      q = q.not('delivery_type', 'in', `(${excludeDeliveryTypes.join(',')})`)
    }

    if (paymentTypes.length > 0) {
      q = q.in('payment_type', paymentTypes)
    }

    const { data, error, count } = await q

    if (error) {
      console.error('[Supabase]', error.message, error)
      throw new Error(error.message)
    }

    return {
      orders: (data ?? []).map(mapOrder),
      total: count ?? 0,
    }
  },

  // История стола: рассчитанные dine-in чеки (check_status='settled') за один день.
  // Возвращает страницу + общее количество (count: 'exact') для пагинации.
  async listTableSessions(
    sb: SupabaseClient,
    tenantId: string,
    params: TableSessionsParams,
  ): Promise<TableSessionsResult> {
    const limit = params.limit ?? DEFAULT_PAGE_SIZE
    const offset = params.offset ?? 0
    const { from: dayFrom, to: dayTo } = dayBounds(params.date, params.from, params.to)

    // Скоуп по филиалу идёт через стол (tables.branch_id), а НЕ через orders.branch_id:
    // dine-in заказы создаются без branch_id (см. useAddDishToTable), а стол всегда
    // принадлежит филиалу (tables.branch_id NOT NULL). Поэтому inner-join к tables и
    // фильтр по его branch_id — иначе вся история была бы пуста на заказах без branch_id.
    let q = sb
      .from('orders')
      .select(
        'id, created_at, settled_at, table_id, table_name, customer_name, customer_phone, total, subtotal, discount_amount, payment_type, settled_by, check_status, order_items(count), tables!inner(branch_id)',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .eq('check_status', 'settled')
      .not('table_id', 'is', null)
      .gte('created_at', dayFrom)
      .lt('created_at', dayTo)
      .order('settled_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (params.branchId !== null) q = q.eq('tables.branch_id', params.branchId)
    if (params.tableId) q = q.eq('table_id', params.tableId)
    if (params.search) {
      const safe = sanitizeOrSearch(params.search)
      const phoneDigits = normalizePhone(params.search)
      const phonePart = phoneDigits.length >= 3
        ? `customer_phone.ilike.%${phoneDigits}%`
        : `customer_phone.ilike.%${safe}%`

      q = q.or(`customer_name.ilike.%${safe}%,${phonePart}`)
    }
    if (params.minTotal !== undefined) q = q.gte('total', params.minTotal)

    const { data, error, count } = await q

    if (error) {
      reportError(error, { context: 'orders-table-sessions' })

      throw new Error('Не удалось загрузить историю стола')
    }

    return {
      sessions: (data ?? []).map(mapTableSession),
      total: count ?? 0,
    }
  },

  async update(sb: SupabaseClient, orderId: string, data: OrderUpdateData): Promise<Order | null> {
    const itemsJson = data.items ? toItemRows(data.items) : null
    const orderPatch = toOrderPayload(data)

    await query(sb.rpc('update_order_with_items', {
      p_order_id: orderId,
      p_order_patch: Object.keys(orderPatch).length > 0 ? orderPatch : {},
      p_items_json: itemsJson,
    }))

    const result = await query(
      sb.from('orders').select(ORDER_SELECT).eq('id', orderId).single(),
    )

    return result ? mapOrder(result) : null
  },

  async counts(sb: SupabaseClient, tenantId: string, branchId: string | null = null, excludeDeliveryTypes: string[] = []) {
    let q = sb.from('orders').select('status').eq('tenant_id', tenantId)

    if (branchId !== null) q = q.eq('branch_id', branchId)
    if (excludeDeliveryTypes.length > 0) {
      q = q.not('delivery_type', 'in', `(${excludeDeliveryTypes.join(',')})`)
    }
    const data = await query(q)

    return (data ?? []).reduce<Record<string, number>>((acc, row) => {
      const s = (row as Pick<OrderRow, 'status'>).status

      acc[s] = (acc[s] ?? 0) + 1

      return acc
    }, {})
  },

  async listIdsForTable(sb: SupabaseClient, tableId: string, excludeStatusIds: string[]): Promise<string[]> {
    let q = sb.from('orders').select('id').eq('table_id', tableId)

    if (excludeStatusIds.length) {
      q = q.not('status', 'in', `(${excludeStatusIds.join(',')})`)
    }

    const data = await query(q)

    return (data ?? []).map((row) => (row as { id: string }).id)
  },

  async findTableItem(
    sb: SupabaseClient,
    tableId: string,
    match: { dishName: string; modifiers: OrderItemModifier[]; addons: OrderItemAddon[]; removedIngredients: string[] },
  ): Promise<{ id: string; orderId: string } | null> {
    const q = sb
      .from('order_items')
      .select('id, order_id, modifiers, addons, removed_ingredients, orders!inner(table_id, check_status)')
      .eq('dish_name', match.dishName)
      .eq('orders.table_id', tableId)
      .eq('orders.check_status', 'open')

    const data = await query(q)

    type Row = { id: string; order_id: string; modifiers: OrderItemModifier[]; addons: OrderItemAddon[]; removed_ingredients: string[] }

    const targetKey = orderItemKey(match.modifiers, match.addons, match.removedIngredients)
    const row = (data ?? []).find((r) => {
      const item = r as Row

      return orderItemKey(item.modifiers ?? [], item.addons ?? [], item.removed_ingredients ?? []) === targetKey
    }) as Row | undefined

    return row ? { id: row.id, orderId: row.order_id } : null
  },

  async removeItem(sb: SupabaseClient, orderItemId: string): Promise<void> {
    // Атомарно: lock на orders, DELETE order_item, DELETE order если пусто.
    // kitchen_queue cascades через ON DELETE CASCADE.
    const envelope = await query(
      sb.rpc('delete_order_item_atomic', { p_order_item_id: orderItemId }),
    ) as RemoveItemEnvelope | null

    if (!envelope) {
      // empty_envelope = реальная ошибка RPC (Postgres вернул NULL вместо jsonb).
      reportError(new Error('delete_order_item_atomic returned empty envelope'), {
        context: 'orders.removeItem',
        orderItemId,
      })
      throw new Error('Ошибка сервера')
    }
    if (envelope.ok === false) {
      // not_found — типичный double-click / stale realtime UI (другой кассир
      // уже удалил), Sentry не нужен.
      // forbidden — permission снят между загрузкой UI и кликом, тоже не bug.
      throw new Error(envelope.reason === 'forbidden' ? 'Недостаточно прав' : 'Позиция не найдена')
    }
  },

  // Append-only дозаказ блюд в принятый (in_progress) заказ доставки/самовывоза.
  // RPC add_items_to_order дописывает позиции + точечно наполняет кухню на новых
  // строках. Существующие позиции не трогаются (полная замена через update для
  // не-new намеренно отключена — иначе DELETE+reinsert уничтожил бы kitchen_queue).
  async addItems(sb: SupabaseClient, orderId: string, items: OrderItem[]): Promise<void> {
    const payload = items.map((i) => ({
      dish_name: i.dishName,
      price: i.price,
      quantity: i.quantity,
      dish_id: i.dishId,
      combo_id: i.comboId,
      combo_items: i.comboItems,
      category_name: i.categoryName,
      removed_ingredients: i.removedIngredients,
      modifiers: i.modifiers,
      addons: i.addons,
    }))

    const { error } = await sb.rpc('add_items_to_order', {
      p_order_id: orderId,
      p_items_json: payload,
    })

    if (error) {
      reportError(error, { context: 'orders.addItems', orderId })
      throw error
    }
  },

  async updateStatus(sb: SupabaseClient, orderId: string, status: string) {
    // PREPROD-144: переход в группу cancelled должен атомарно откатывать
    // used_count промокода — иначе клиент не сможет реюзнуть код после
    // того как админ отменил его заказ. RPC update_order_status делает
    // UPDATE + декремент в одной транзакции.
    const { error } = await sb.rpc('update_order_status', {
      p_order_id: orderId,
      p_new_status: status,
    })

    if (error) {
      reportError(error, { context: 'ordersApi.updateStatus', orderId, status })
      // Локализуем Postgres-коды как в `query()` helper'е (сосед update() так делает).
      // 42501 — RAISE EXCEPTION 'Permission denied' / cross-tenant guard.
      // P0001 — RAISE EXCEPTION 'Order not found' (или другой бизнес-fail в RPC).
      const userMessage = error.code === '42501'
        ? 'Недостаточно прав'
        : error.code === 'P0001'
          ? 'Заказ не найден'
          : 'Не удалось изменить статус заказа'

      throw new Error(userMessage)
    }
  },

  async markKitchenCompleted(sb: SupabaseClient, orderId: string): Promise<void> {
    await query(
      sb.from('orders')
        .update({ kitchen_completed_at: new Date().toISOString() })
        .eq('id', orderId),
    )
  },

  async create(sb: SupabaseClient, data: OrderCreateData): Promise<Order | null> {
    const result = await query(
      sb.from('orders').insert({
        ...toOrderPayload(data),
        tenant_id: data.tenantId,
        branch_id: data.branchId,
        ...(data.tableId ? { table_id: data.tableId, table_name: data.tableName ?? null } : {}),
        ...(data.idempotencyKey ? { idempotency_key: data.idempotencyKey } : {}),
      }).select().single(),
    )

    if (!result) return null

    const orderId = (result as { id: string }).id
    const itemRows = toItemRows(data.items, orderId)

    if (itemRows.length > 0) {
      await query(sb.from('order_items').insert(itemRows))
    }

    const full = await query(
      sb.from('orders').select(ORDER_SELECT).eq('id', orderId).single(),
    )

    return full ? mapOrder(full) : null
  },

  async getById(sb: SupabaseClient, orderId: string): Promise<Order | null> {
    const result = await query(
      sb.from('orders').select(ORDER_SELECT).eq('id', orderId).single(),
    )

    return result ? mapOrder(result) : null
  },

  async getStatsForPeriod(
    sb: SupabaseClient,
    tenantId: string,
    dateFrom: string,
    dateTo: string,
    branchId: string | null = null,
  ): Promise<Array<{ id: string; total: number; createdAt: string; deliveryType: OrderDeliveryType; items: Array<{ dishName: string; quantity: number; categoryName: string | null }> }>> {
    let q = sb
      .from('orders')
      .select('id, total, created_at, delivery_type, order_items(dish_name, quantity, category_name)')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)
      // Считаем только не-dine_in (check_status IS NULL) и РАССЧИТАННЫЕ чеки.
      // open (не оплачен) и cancelled (пустой, total=0) — не выручка/не заказ.
      .or('check_status.is.null,check_status.eq.settled')

    if (branchId !== null) q = q.eq('branch_id', branchId)

    const { data, error } = await q

    if (error) {
      console.error('[Supabase]', error.message, error)
      throw new Error(error.message)
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      total: row.total as number,
      createdAt: row.created_at as string,
      deliveryType: row.delivery_type as OrderDeliveryType,
      items: ((row.order_items as Array<{ dish_name: string; quantity: number; category_name: string | null }>) ?? []).map((i) => ({
        dishName: i.dish_name,
        quantity: i.quantity,
        categoryName: i.category_name ?? null,
      })),
    }))
  },

  async confirmItem(sb: SupabaseClient, itemId: string, userId: string): Promise<void> {
    await query(
      sb.from('order_items')
        .update({ status: 'confirmed', confirmed_by: userId })
        .eq('id', itemId)
        .eq('status', 'pending'),
    )
  },

  async rejectItem(sb: SupabaseClient, itemId: string): Promise<void> {
    await query(
      sb.from('order_items')
        .delete()
        .eq('id', itemId)
        .eq('status', 'pending'),
    )
  },

  async ensureScheduledHoldingStatus(sb: SupabaseClient, tenantId: string): Promise<string | null> {
    const { data, error } = await sb.rpc('ensure_scheduled_holding_status', { p_tenant_id: tenantId })

    if (error) throw error

    return data as string | null
  },

  async confirmAllPendingItems(sb: SupabaseClient, tableId: string, userId: string): Promise<void> {
    // Один открытый чек на стол — подтверждаем его pending-позиции.
    const check = await query(
      sb.from('orders').select('id').eq('table_id', tableId).eq('check_status', 'open').maybeSingle(),
    )

    if (!check) return

    await query(
      sb.from('order_items')
        .update({ status: 'confirmed', confirmed_by: userId })
        .eq('status', 'pending')
        .eq('order_id', (check as { id: string }).id),
    )
  },
}
