import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getItemUnitPrice } from '@fastio/shared'
import type { DishCartItem } from '~/features/cart'

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

// Сигнатура позиции для дедупа в драфте: одинаковое блюдо с теми же модификаторами/
// аддонами/убранными ингредиентами мёрджится в одну строку (qty++). Семантика как у
// корзины, но строже: учитываем ещё и comboId (два разных комбо с dishId=null не
// схлопываются), поэтому сигнатура полнее, чем dishId-only дедуп в useCartStore.add.
const draftSignature = (i: DishCartItem) =>
  [
    i.dishId ?? '',
    i.comboId ?? '',
    JSON.stringify(i.removedIngredients ?? []),
    JSON.stringify(i.modifiers ?? []),
    JSON.stringify(i.addons ?? []),
  ].join('|')

export const useTableStore = defineStore('table', () => {
  const tableId = ref<string | null>(null)
  const tableName = ref<string | null>(null)
  const checkItems = ref<CheckItem[]>([])
  // Локальный драфт нового заказа: гость накапливает позиции, отправляет всё разом
  // одним POST /api/orders. НЕ путать с checkItems (уже отправлено на кухню).
  const draftItems = ref<DishCartItem[]>([])

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

  const draftCount = computed(() =>
    draftItems.value.reduce((s, i) => s + i.quantity, 0),
  )

  const draftTotal = computed(() =>
    draftItems.value.reduce((sum, i) => sum + getItemUnitPrice(i) * i.quantity, 0),
  )

  function setTable(id: string, name: string) {
    tableId.value = id
    tableName.value = name
  }

  function setCheckItems(items: CheckItem[]) {
    checkItems.value = items
  }

  function addDraftItem(item: DishCartItem) {
    const sig = draftSignature(item)
    const existing = draftItems.value.find(i => draftSignature(i) === sig)
    if (existing) {
      existing.quantity += item.quantity
    } else {
      draftItems.value.push({ ...item, _key: crypto.randomUUID() })
    }
  }

  function updateDraftQty(key: string, quantity: number) {
    const target = draftItems.value.find(i => i._key === key)
    if (!target) return
    if (quantity <= 0) {
      removeDraftItem(key)

      return
    }
    target.quantity = quantity
  }

  function removeDraftItem(key: string) {
    const index = draftItems.value.findIndex(i => i._key === key)
    if (index !== -1) draftItems.value.splice(index, 1)
  }

  // Удаляет ровно отправленные позиции по snapshot их `_key`. Нужен после успешной
  // отправки: пока POST в полёте, гость мог добавить новое блюдо — его НЕЛЬЗЯ стирать
  // вместе с отправленными (иначе тихая потеря позиции). Используется вместо clearDraft.
  function removeDraftByKeys(keys: Set<string>) {
    draftItems.value = draftItems.value.filter(i => !keys.has(i._key))
  }

  function clearDraft() {
    draftItems.value = []
  }

  function clear() {
    tableId.value = null
    tableName.value = null
    checkItems.value = []
    draftItems.value = []
  }

  return {
    tableId, tableName, checkItems, draftItems,
    isTableMode, checkTotal, itemCount, draftCount, draftTotal,
    setTable, setCheckItems, addDraftItem, updateDraftQty, removeDraftItem, removeDraftByKeys, clearDraft, clear,
  }
})
