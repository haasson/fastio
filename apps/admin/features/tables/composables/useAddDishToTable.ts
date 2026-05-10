import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMessage } from '@fastio/ui'
import type { Table, OrderItem } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useAuthStore } from '~/stores/auth'
import { useOrderStatusesStore } from '~/stores/retail/order-statuses'
import type { DishPickerResult } from '~/components/menu/DishPickerModal.vue'
import type { TableSessionItem } from '~/utils/api/retail/tables'

export default function useAddDishToTable(getTenantId: () => string | null) {
  const api = useDatabase()
  const authStore = useAuthStore()
  const orderStatusesStore = useOrderStatusesStore()
  const { statuses } = storeToRefs(orderStatusesStore)
  const { success, warning } = useMessage()

  const dishPickerOpen = ref(false)
  const dishPickerTable = ref<Table | null>(null)

  const openPicker = (table: Table) => {
    dishPickerTable.value = table
    dishPickerOpen.value = true
  }

  const createTableOrder = async (item: OrderItem, totalPrice: number, table: Table, tenantId: string) => {
    const newStatusId = statuses.value.find((s) => s.groupType === 'new')?.id

    if (!newStatusId) {
      warning('Статусы заказов не загружены, попробуйте ещё раз')

      return
    }

    await api.orders.create({
      tenantId,
      branchId: null,
      customerName: null,
      customerPhone: '',
      items: [item],
      deliveryType: 'dine_in',
      address: null,
      comment: null,
      promoCode: null,
      discountAmount: 0,
      subtotal: totalPrice,
      deliveryFee: 0,
      total: totalPrice,
      status: newStatusId,
      paymentType: 'cash',
      tableId: table.id,
      tableName: table.name,
    })
  }

  const onDishPicked = async (result: DishPickerResult) => {
    const table = dishPickerTable.value
    const tenantId = getTenantId()

    if (!table || !tenantId) return

    dishPickerOpen.value = false

    const modifiersDelta = (result.modifiers ?? []).reduce((sum, m) => sum + (m.priceDelta ?? 0), 0)
    const addonsDelta = (result.addons ?? []).reduce((sum, a) => sum + (a.price ?? 0), 0)
    const unitPrice = result.price + modifiersDelta + addonsDelta
    const totalPrice = unitPrice * result.quantity

    await createTableOrder({
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
    }, totalPrice, table, tenantId)
    success(`${result.dishName} добавлено`)
  }

  const repeatItem = async (sessionItem: TableSessionItem, table: Table) => {
    const tenantId = getTenantId()

    if (!tenantId) return

    if (!sessionItem.dishId) {
      warning('Невозможно повторить блюдо — отсутствует ID')

      return
    }

    await createTableOrder({
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
    }, sessionItem.price, table, tenantId)
    success(`+1 ${sessionItem.dishName}`)
  }

  return { dishPickerOpen, openPicker, onDishPicked, repeatItem }
}
