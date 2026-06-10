import { ref } from 'vue'
import { useMessage } from '@fastio/ui'
import type { Table, OrderItem } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import { useDatabase } from '~/shared/data/useDatabase'
import { useAuthStore } from '~/shared/stores/auth'
import type { DishPickerResult } from '~/features/menu'
import type { TableSessionItem } from '../api/tables'

export function useAddDishToTable(getTenantId: () => string | null, onChanged?: (tableId: string) => void) {
  const api = useDatabase()
  const authStore = useAuthStore()
  const { success, warning } = useMessage()

  const dishPickerOpen = ref(false)
  const dishPickerTable = ref<Table | null>(null)

  const openPicker = (table: Table) => {
    dishPickerTable.value = table
    dishPickerOpen.value = true
  }

  const addOne = async (item: OrderItem, table: Table) => {
    try {
      await api.tables.addItems(table.id, [item], authStore.user?.id ?? null)
    } catch (e) {
      reportError(e, { context: 'useAddDishToTable.addOne', tableId: table.id })
      warning('Не удалось добавить блюдо')

      return false
    }

    return true
  }

  const onDishPicked = async (result: DishPickerResult) => {
    const table = dishPickerTable.value
    const tenantId = getTenantId()

    if (!table || !tenantId) return

    dishPickerOpen.value = false

    const modifiersDelta = (result.modifiers ?? []).reduce((sum, m) => sum + (m.priceDelta ?? 0), 0)
    const addonsDelta = (result.addons ?? []).reduce((sum, a) => sum + (a.price ?? 0), 0)
    const unitPrice = result.price + modifiersDelta + addonsDelta

    const item: OrderItem = {
      dishId: result.dishId,
      comboId: result.comboId ?? null,
      dishName: result.dishName,
      categoryName: result.categoryName,
      price: unitPrice,
      quantity: result.quantity,
      customizable: result.customizable,
      removedIngredients: result.removedIngredients,
      modifiers: result.modifiers,
      addons: result.addons,
      completedAt: null,
      comboItems: null,
      addedBy: authStore.user?.id ?? null,
      confirmedBy: authStore.user?.id ?? null,
      status: 'confirmed' as const,
    }

    const ok = await addOne(item, table)

    if (ok) {
      success(`${result.dishName} добавлено`)
      onChanged?.(table.id)
    }
  }

  const repeatItem = async (sessionItem: TableSessionItem, table: Table) => {
    const tenantId = getTenantId()

    if (!tenantId) return

    if (!sessionItem.dishId) {
      warning('Невозможно повторить блюдо — отсутствует ID')

      return
    }

    const item: OrderItem = {
      dishId: sessionItem.dishId,
      comboId: null,
      dishName: sessionItem.dishName,
      categoryName: sessionItem.categoryName,
      price: sessionItem.price,
      quantity: 1,
      removedIngredients: sessionItem.removedIngredients,
      modifiers: sessionItem.modifiers,
      addons: sessionItem.addons,
      completedAt: null,
      comboItems: null,
      addedBy: authStore.user?.id ?? null,
      confirmedBy: authStore.user?.id ?? null,
      status: 'confirmed' as const,
    }

    const ok = await addOne(item, table)

    if (ok) {
      success(`+1 ${sessionItem.dishName}`)
      onChanged?.(table.id)
    }
  }

  return { dishPickerOpen, openPicker, onDishPicked, repeatItem }
}
