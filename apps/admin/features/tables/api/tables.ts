import type { SupabaseClient } from '@supabase/supabase-js'
import type { Table, TableFormData, TableShape, OrderItem, OrderItemModifier, OrderItemAddon } from '@fastio/shared'
import { orderItemKey } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import { query } from '~/shared/utils/query'
import type { TableRow } from '~/shared/data/db-types'

export type TableSessionItem = {
  id: string | null
  dishId: string | null
  dishName: string
  categoryName: string | null
  quantity: number
  price: number
  modifiers: OrderItemModifier[]
  addons: OrderItemAddon[]
  removedIngredients: string[]
  status: 'pending' | 'confirmed'
  // Состав комбо (имена блюд внутри) — для «?» в чеке. null у обычных блюд.
  comboItems: { dishName: string }[] | null
}

export type TableSession = {
  sum: number
  items: TableSessionItem[]
}

// Экспортируется для realtime-канала (useTablesChannel) — маппит payload строки.
export const mapTable = (raw: Record<string, unknown>): Table => {
  const row = raw as TableRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    name: row.name,
    isOpen: row.is_open,
    isActive: row.is_active,
    openedAt: row.opened_at,
    createdAt: row.created_at,
    capacity: row.capacity,
    tags: row.tags ?? [],
    positionX: row.position_x,
    positionY: row.position_y,
    shape: (row.shape as TableShape) ?? 'rectangle',
    tableWidth: row.table_width ?? 120,
    tableHeight: row.table_height ?? 80,
    rotation: row.rotation ?? 0,
    color: row.color,
    notes: row.notes,
  }
}

export const tablesApi = {
  async list(sb: SupabaseClient, tenantId: string, branchId?: string | null): Promise<Table[]> {
    let q = sb.from('tables')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at')

    if (branchId !== undefined && branchId !== null) {
      q = q.eq('branch_id', branchId)
    }

    const data = await query(q)

    return (data ?? []).map(mapTable)
  },

  async add(sb: SupabaseClient, tenantId: string, data: TableFormData): Promise<Table | null> {
    // Инвариант: стол всегда принадлежит филиалу (БД: tables.branch_id NOT NULL).
    // Защита от создания «осиротевшего» стола до удара в constraint.
    if (!data.branchId) {
      reportError(new Error('tables.add: branch_id обязателен — стол не может быть без филиала'), {
        context: 'tables.add',
        tenantId,
      })

      return null
    }

    const result = await query(
      sb.from('tables').insert({
        tenant_id: tenantId,
        name: data.name,
        branch_id: data.branchId,
        capacity: data.capacity ?? null,
        tags: data.tags ?? [],
        notes: data.notes ?? null,
        shape: data.shape ?? 'rectangle',
        table_width: data.tableWidth ?? 120,
        table_height: data.tableHeight ?? 80,
        position_x: data.positionX ?? null,
        position_y: data.positionY ?? null,
      }).select().single(),
    )

    return result ? mapTable(result) : null
  },

  async updateMeta(sb: SupabaseClient, id: string, data: Partial<TableFormData>): Promise<Table | null> {
    const patch: Record<string, unknown> = {}

    if (data.name !== undefined) patch.name = data.name
    if (data.capacity !== undefined) patch.capacity = data.capacity
    if (data.tags !== undefined) patch.tags = data.tags
    if (data.notes !== undefined) patch.notes = data.notes
    if (data.shape !== undefined) patch.shape = data.shape
    if (data.tableWidth !== undefined) patch.table_width = data.tableWidth
    if (data.tableHeight !== undefined) patch.table_height = data.tableHeight
    if (data.rotation !== undefined) patch.rotation = data.rotation
    if (data.color !== undefined) patch.color = data.color

    const result = await query(
      sb.from('tables').update(patch).eq('id', id).select().single(),
    )

    return result ? mapTable(result) : null
  },

  async setActive(sb: SupabaseClient, id: string, isActive: boolean): Promise<Table | null> {
    const result = await query(
      sb.from('tables')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single(),
    )

    return result ? mapTable(result) : null
  },

  async updatePosition(sb: SupabaseClient, id: string, x: number | null, y: number | null): Promise<void> {
    await query(sb.from('tables').update({ position_x: x, position_y: y }).eq('id', id))
  },

  // Открытие стола = создание открытого чека (RPC: атомарно is_open+opened_at+INSERT
  // чека, партиал-уникальный индекс ловит гонку двойного открытия). Возвращает id чека.
  async openCheck(sb: SupabaseClient, tableId: string): Promise<string | null> {
    const { data, error } = await sb.rpc('open_table_check', { p_table_id: tableId })

    if (error) {
      reportError(error, { context: 'tablesApi.openCheck', tableId })
      const msg = error.code === '42501'
        ? 'Недостаточно прав'
        : error.code === 'P0001'
          ? 'Не удалось открыть стол'
          : 'Ошибка открытия стола'

      throw new Error(msg)
    }

    return (data as string | null) ?? null
  },

  // Дописать позиции в открытый чек стола (официант → confirmed, сразу на кухню
  // через item-триггеры). RPC сам резолвит открытый чек по table_id и пересчитывает
  // subtotal/total.
  async addItems(sb: SupabaseClient, tableId: string, items: OrderItem[], userId: string | null): Promise<void> {
    const itemsJson = items.map((it) => ({
      dish_id: it.dishId,
      combo_id: it.comboId ?? null,
      combo_items: it.comboItems ?? null,
      dish_name: it.dishName,
      category_name: it.categoryName ?? null,
      price: it.price,
      quantity: it.quantity,
      removed_ingredients: it.removedIngredients ?? [],
      modifiers: it.modifiers ?? [],
      addons: it.addons ?? [],
      added_by: userId,
    }))

    const { error } = await sb.rpc('add_items_to_check', {
      p_table_id: tableId,
      p_items_json: itemsJson,
      p_status: 'confirmed',
    })

    if (error) {
      reportError(error, { context: 'tablesApi.addItems', tableId })
      throw new Error(error.code === 'P0001' ? 'Стол не открыт' : 'Не удалось добавить блюдо')
    }
  },

  // id открытого чека стола (для расчёта). null если открытого чека нет.
  async getOpenCheckId(sb: SupabaseClient, tableId: string): Promise<string | null> {
    const row = await query(
      sb.from('orders').select('id').eq('table_id', tableId).eq('check_status', 'open').maybeSingle(),
    )

    return (row as { id: string } | null)?.id ?? null
  },

  async loadSums(sb: SupabaseClient, tables: Table[], _cancelledStatusIds: string[]): Promise<Record<string, TableSession>> {
    const openTables = tables.filter((t) => t.isOpen)

    if (!openTables.length) return {}

    const tableIds = openTables.map((t) => t.id)

    const data = await query(
      sb.from('orders')
        .select('id, table_id, order_items(id, dish_id, dish_name, category_name, quantity, price, modifiers, addons, removed_ingredients, status, combo_items)')
        .in('table_id', tableIds)
        .eq('check_status', 'open'),
    )

    type RawItem = {
      id: string
      dish_id: string | null
      dish_name: string
      category_name: string | null
      quantity: number
      price: number
      modifiers: OrderItemModifier[]
      addons: OrderItemAddon[]
      removed_ingredients: string[]
      status: 'pending' | 'confirmed'
      combo_items: { dishName: string }[] | null
    }
    type OpenCheck = { id: string; table_id: string; order_items: RawItem[] }

    const result: Record<string, TableSession> = {}
    const itemKey = (i: RawItem) => `${i.dish_name}::${orderItemKey(i.modifiers ?? [], i.addons ?? [], i.removed_ingredients ?? [])}`

    for (const check of (data ?? []) as OpenCheck[]) {
      const session: TableSession = { sum: 0, items: [] }
      const keyMap = new Map<string, TableSessionItem>()

      for (const item of check.order_items ?? []) {
        session.sum += item.price * item.quantity

        if (item.status === 'pending') {
          session.items.push({
            id: item.id,
            dishId: item.dish_id ?? null,
            dishName: item.dish_name,
            categoryName: item.category_name ?? null,
            quantity: item.quantity,
            price: item.price,
            modifiers: item.modifiers ?? [],
            addons: item.addons ?? [],
            removedIngredients: item.removed_ingredients ?? [],
            status: 'pending',
            comboItems: item.combo_items ?? null,
          })
        } else {
          const key = itemKey(item)
          const existing = keyMap.get(key)

          if (existing) {
            existing.quantity += item.quantity
          } else {
            const newItem: TableSessionItem = {
              id: null,
              dishId: item.dish_id ?? null,
              dishName: item.dish_name,
              categoryName: item.category_name ?? null,
              quantity: item.quantity,
              price: item.price,
              modifiers: item.modifiers ?? [],
              addons: item.addons ?? [],
              removedIngredients: item.removed_ingredients ?? [],
              status: 'confirmed',
              comboItems: item.combo_items ?? null,
            }

            keyMap.set(key, newItem)
            session.items.push(newItem)
          }
        }
      }

      result[check.table_id] = session
    }

    return result
  },

  async listTags(sb: SupabaseClient, tenantId: string): Promise<string[]> {
    const data = await query(
      sb.from('tables').select('tags').eq('tenant_id', tenantId).eq('is_active', true),
    )
    const all = (data ?? []).flatMap((row: { tags: string[] }) => row.tags ?? [])

    return [...new Set(all)].sort()
  },

  // Расчёт чека: скидка + способ оплаты (payment_type), фиксация settled_by/at,
  // закрытие стола, завершение seated-брони — атомарно в RPC. Пустой чек (0 позиций)
  // RPC сам помечает cancelled.
  async settleCheck(
    sb: SupabaseClient,
    checkId: string,
    discountAmount: number,
    paymentType: 'cash' | 'card',
  ): Promise<void> {
    const { error } = await sb.rpc('settle_table_check', {
      p_check_id: checkId,
      p_discount_amount: discountAmount,
      p_payment_type: paymentType,
    })

    if (error) {
      reportError(error, { context: 'tablesApi.settleCheck', checkId })
      const msg = error.code === '42501'
        ? 'Недостаточно прав'
        : error.code === 'P0001'
          ? 'Не удалось рассчитать стол'
          : 'Ошибка расчёта'

      throw new Error(msg)
    }
  },

  async archive(sb: SupabaseClient, id: string): Promise<void> {
    await query(
      sb.from('table_calls')
        .update({ resolved_at: new Date().toISOString() })
        .eq('table_id', id)
        .is('resolved_at', null),
    )
    await query(sb.from('tables').update({ is_active: false, is_open: false }).eq('id', id))
  },
}
