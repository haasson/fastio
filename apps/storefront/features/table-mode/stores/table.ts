import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getItemUnitPrice } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
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

// Дедуп позиций чека для отображения — как в админке (tablesApi.loadSums): одинаковые
// блюда схлопываются в одну строку с суммарным количеством. Ключ — имя + модификаторы
// + аддоны + убранные ингредиенты (отсортированы), как orderItemKey. Применять
// ПО-ГРУППно (внутри «готовится»/«готово»): статус/kitchenStatus у группы общий.
export const aggregateCheckItems = (items: CheckItem[]): CheckItem[] => {
  // Цену включаем в ключ (в отличие от админки): если цена блюда менялась в ходе
  // сессии, разноценовые отправки останутся разными строками — суммы строк всегда
  // сходятся с футером «Итого». Обычный кейс (та же цена) мёрджится как и раньше.
  const sig = (i: CheckItem) =>
    [
      i.dishName,
      i.price,
      i.modifiers.map((m) => m.optionName).sort().join(','),
      i.addons.map((a) => a.addonName).sort().join(','),
      [...i.removedIngredients].sort().join(','),
    ].join('|')

  const map = new Map<string, CheckItem>()
  for (const item of items) {
    const key = sig(item)
    const existing = map.get(key)
    if (existing) {
      existing.quantity += item.quantity
    } else {
      map.set(key, { ...item })
    }
  }

  return [...map.values()]
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

  // Драфт (несобранный заказ) переживает рефреш: кладём в sessionStorage. Один ключ
  // на вкладку, tableId — внутри payload: при смене QR-стола в той же вкладке restore
  // сверяет id и НЕ воскрешает драфт другого стола. sessionStorage (не local) живёт в
  // пределах вкладки — рефреш сохраняет, закрытие чистит. checkItems НЕ кешируем
  // (live-state, см. AGENTS.md) — только локальный драфт гостя.
  const DRAFT_KEY = 'table-draft'

  const persistDraft = () => {
    if (typeof sessionStorage === 'undefined' || !tableId.value) return
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ tableId: tableId.value, items: draftItems.value }))
    } catch (e) {
      reportError(e instanceof Error ? e : new Error('[table store] persistDraft failed'))
    }
  }

  // Восстановление драфта для текущего стола. Зовётся из page в onMounted (client-only),
  // чтобы не словить hydration mismatch (на SSR sessionStorage недоступен).
  function restoreDraft() {
    if (typeof sessionStorage === 'undefined' || !tableId.value) return
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { tableId?: string; items?: unknown }
      // Драфт другого стола (сменили QR в той же вкладке) — игнорируем, не воскрешаем.
      if (parsed.tableId !== tableId.value) return
      if (Array.isArray(parsed.items)) draftItems.value = parsed.items as DishCartItem[]
    } catch (e) {
      reportError(e instanceof Error ? e : new Error('[table store] restoreDraft failed'))
    }
  }

  // Персистим в самих экшенах, а НЕ через watch(draftItems): Pinia для setup-стора
  // применяет SSR-состояние после регистрации watch'ей, поэтому deep-watch срабатывал
  // на гидрации и затирал сохранённый драфт пустым серверным [] до restoreDraft.
  // Экшены вызываются только пользователем — гидрация их не триггерит.

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
    persistDraft()
  }

  function updateDraftQty(key: string, quantity: number) {
    const target = draftItems.value.find(i => i._key === key)
    if (!target) return
    if (quantity <= 0) {
      removeDraftItem(key)

      return
    }
    target.quantity = quantity
    persistDraft()
  }

  function removeDraftItem(key: string) {
    const index = draftItems.value.findIndex(i => i._key === key)
    if (index !== -1) draftItems.value.splice(index, 1)
    persistDraft()
  }

  // Удаляет ровно отправленные позиции по snapshot их `_key`. Нужен после успешной
  // отправки: пока POST в полёте, гость мог добавить новое блюдо — его НЕЛЬЗЯ стирать
  // вместе с отправленными (иначе тихая потеря позиции). Используется вместо clearDraft.
  function removeDraftByKeys(keys: Set<string>) {
    draftItems.value = draftItems.value.filter(i => !keys.has(i._key))
    persistDraft()
  }

  function clearDraft() {
    draftItems.value = []
    persistDraft()
  }

  function clear() {
    // Стол закрыт — чистим и персист драфта.
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(DRAFT_KEY)
      } catch (e) {
        reportError(e instanceof Error ? e : new Error('[table store] clear draft storage failed'))
      }
    }
    tableId.value = null
    tableName.value = null
    checkItems.value = []
    draftItems.value = []
  }

  return {
    tableId, tableName, checkItems, draftItems,
    isTableMode, checkTotal, itemCount, draftCount, draftTotal,
    setTable, setCheckItems, addDraftItem, updateDraftQty, removeDraftItem, removeDraftByKeys, clearDraft, restoreDraft, clear,
  }
})
