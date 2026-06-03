import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTableStore, aggregateCheckItems, type CheckItem } from '../stores/table'
import type { DishCartItem } from '../../cart/stores/cart'

const makeCheck = (overrides: Partial<CheckItem> = {}): CheckItem => ({
  id: crypto.randomUUID(),
  dishName: 'Бургер',
  price: 300,
  quantity: 1,
  modifiers: [],
  addons: [],
  removedIngredients: [],
  status: 'confirmed',
  kitchenStatus: 'done',
  ...overrides,
})

const makeDish = (overrides: Partial<DishCartItem> = {}): DishCartItem => ({
  kind: 'dish',
  _key: 'seed',
  dishId: 'd1',
  comboId: null,
  dishName: 'Пицца',
  categoryName: 'Пиццы',
  price: 500,
  quantity: 1,
  modifiers: [],
  addons: [],
  removedIngredients: [],
  photo: null,
  completedAt: null,
  comboItems: null,
  addedBy: null,
  confirmedBy: null,
  status: 'pending',
  ...overrides,
})

describe('useTableStore — draft', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('addDraftItem добавляет позицию с собственным _key (не переиспользует входной)', () => {
    const store = useTableStore()
    store.addDraftItem(makeDish())

    expect(store.draftItems).toHaveLength(1)
    expect(store.draftItems[0].dishId).toBe('d1')
    expect(store.draftItems[0]._key).not.toBe('seed')
    expect(store.draftCount).toBe(1)
  })

  it('дедупит одинаковую сигнатуру (qty++)', () => {
    const store = useTableStore()
    store.addDraftItem(makeDish({ quantity: 1 }))
    store.addDraftItem(makeDish({ quantity: 2 }))

    expect(store.draftItems).toHaveLength(1)
    expect(store.draftItems[0].quantity).toBe(3)
    expect(store.draftCount).toBe(3)
  })

  it('НЕ дедупит разные comboId при dishId=null (строже корзины)', () => {
    const store = useTableStore()
    store.addDraftItem(makeDish({ dishId: null, comboId: 'c1' }))
    store.addDraftItem(makeDish({ dishId: null, comboId: 'c2' }))

    expect(store.draftItems).toHaveLength(2)
  })

  it('updateDraftQty меняет количество; <= 0 удаляет строку', () => {
    const store = useTableStore()
    store.addDraftItem(makeDish())
    const key = store.draftItems[0]._key

    store.updateDraftQty(key, 5)
    expect(store.draftItems[0].quantity).toBe(5)

    store.updateDraftQty(key, 0)
    expect(store.draftItems).toHaveLength(0)
  })

  it('removeDraftByKeys удаляет ровно snapshot, сохраняя добавленное «во время отправки»', () => {
    const store = useTableStore()
    store.addDraftItem(makeDish({ dishId: 'a' }))
    const sentKeys = new Set(store.draftItems.map(i => i._key))

    // гость добавил ещё блюдо, пока POST был в полёте
    store.addDraftItem(makeDish({ dishId: 'b' }))
    store.removeDraftByKeys(sentKeys)

    expect(store.draftItems).toHaveLength(1)
    expect(store.draftItems[0].dishId).toBe('b')
  })

  it('draftTotal = сумма price*quantity', () => {
    const store = useTableStore()
    store.addDraftItem(makeDish({ dishId: 'a', price: 200, quantity: 2 }))
    store.addDraftItem(makeDish({ dishId: 'b', price: 100, quantity: 1 }))

    expect(store.draftTotal).toBe(500)
  })

  it('clearDraft очищает драфт', () => {
    const store = useTableStore()
    store.addDraftItem(makeDish())
    store.clearDraft()

    expect(store.draftItems).toHaveLength(0)
  })
})

describe('aggregateCheckItems', () => {
  it('схлопывает одинаковые блюда в одну строку с суммой qty', () => {
    const res = aggregateCheckItems([
      makeCheck({ dishName: 'Бургер', quantity: 1 }),
      makeCheck({ dishName: 'Бургер', quantity: 2 }),
    ])

    expect(res).toHaveLength(1)
    expect(res[0].quantity).toBe(3)
  })

  it('не схлопывает разные блюда', () => {
    const res = aggregateCheckItems([
      makeCheck({ dishName: 'Бургер' }),
      makeCheck({ dishName: 'Пицца' }),
    ])

    expect(res).toHaveLength(2)
  })

  it('не схлопывает одно блюдо с разными модификаторами', () => {
    const res = aggregateCheckItems([
      makeCheck({ dishName: 'Бургер', modifiers: [{ groupName: 'Прожарка', optionName: 'Medium', priceDelta: 0 }] }),
      makeCheck({ dishName: 'Бургер', modifiers: [{ groupName: 'Прожарка', optionName: 'Well done', priceDelta: 0 }] }),
    ])

    expect(res).toHaveLength(2)
  })

  it('схлопывает несмотря на порядок модификаторов/аддонов (сортировка ключа)', () => {
    const res = aggregateCheckItems([
      makeCheck({ addons: [{ addonName: 'Сыр', price: 50 }, { addonName: 'Бекон', price: 70 }] }),
      makeCheck({ addons: [{ addonName: 'Бекон', price: 70 }, { addonName: 'Сыр', price: 50 }] }),
    ])

    expect(res).toHaveLength(1)
    expect(res[0].quantity).toBe(2)
  })

  it('не схлопывает одинаковое блюдо с разной ценой (суммы строк сходятся с итогом)', () => {
    const res = aggregateCheckItems([
      makeCheck({ dishName: 'Бургер', price: 300 }),
      makeCheck({ dishName: 'Бургер', price: 350 }),
    ])

    expect(res).toHaveLength(2)
  })

  it('не мутирует входные позиции (qty оригиналов нетронут)', () => {
    const input = [
      makeCheck({ dishName: 'Бургер', quantity: 1 }),
      makeCheck({ dishName: 'Бургер', quantity: 2 }),
    ]
    const res = aggregateCheckItems(input)

    expect(res[0].quantity).toBe(3)
    // оригиналы не тронуты — агрегат работает на копиях
    expect(input[0].quantity).toBe(1)
    expect(input[1].quantity).toBe(2)
  })
})
