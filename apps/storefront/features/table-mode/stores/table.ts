import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getItemUnitPrice } from '@fastio/shared'

export type CheckItem = {
  id: string
  dishName: string
  price: number
  quantity: number
  modifiers: { groupName: string; optionName: string; priceDelta: number }[]
  addons: { addonName: string; price: number }[]
  removedIngredients: string[]
  status: 'pending' | 'confirmed'
  kitchenStatus: 'queued' | 'in_progress' | 'done' | 'served' | null
}

export const useTableStore = defineStore('table', () => {
  const tableId = ref<string | null>(null)
  const tableName = ref<string | null>(null)
  const checkItems = ref<CheckItem[]>([])

  const isTableMode = computed(() => !!tableId.value)

  const activeItems = computed(() =>
    checkItems.value.filter(i => i.status === 'pending' || i.status === 'confirmed'),
  )

  const checkTotal = computed(() =>
    activeItems.value.reduce((sum, i) => sum + getItemUnitPrice(i) * i.quantity, 0),
  )

  const itemCount = computed(() =>
    checkItems.value.filter(i => i.status === 'pending' || i.status === 'confirmed').reduce((s, i) => s + i.quantity, 0),
  )

  function setTable(id: string, name: string) {
    tableId.value = id
    tableName.value = name
  }

  function setCheckItems(items: CheckItem[]) {
    checkItems.value = items
  }

  function clear() {
    tableId.value = null
    tableName.value = null
    checkItems.value = []
  }

  return {
    tableId, tableName, checkItems,
    isTableMode, checkTotal, itemCount,
    setTable, setCheckItems, clear,
  }
})
