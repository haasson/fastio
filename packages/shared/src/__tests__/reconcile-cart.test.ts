import { describe, it, expect } from 'vitest'
import { reconcileCart, reconcileServices } from '../utils/reconcile-cart'
import type {
  ReconcileCartItem,
  ReconcileMenuData,
  MenuDish,
  MenuCombo,
  ReconcileService,
  ReconcileServiceItem,
} from '../utils/reconcile-cart'

function makeDish(overrides: Partial<MenuDish> = {}): MenuDish {
  return {
    id: 'dish-1',
    name: 'Бургер',
    price: 500,
    photos: ['photo1.jpg'],
    ingredients: [{ name: 'Лук' }, { name: 'Томат' }, { name: 'Сыр' }],
    ...overrides,
  }
}

function makeCartItem(overrides: Partial<ReconcileCartItem> = {}): ReconcileCartItem {
  return {
    _key: 'key-1',
    dishId: 'dish-1',
    comboId: null,
    dishName: 'Бургер',
    categoryName: 'Бургеры',
    price: 500,
    quantity: 1,
    removedIngredients: [],
    modifiers: [],
    addons: [],
    completedAt: null,
    comboItems: null,
    addedBy: null,
    confirmedBy: null,
    status: 'pending',
    photo: 'photo1.jpg',
    ...overrides,
  }
}

function makeCombo(overrides: Partial<MenuCombo> = {}): MenuCombo {
  return {
    id: 'combo-1',
    name: 'Комбо Обед',
    price: 999,
    photos: ['combo.jpg'],
    ...overrides,
  }
}

function makeMenu(overrides: Partial<ReconcileMenuData> = {}): ReconcileMenuData {
  return {
    dishes: [makeDish()],
    combos: [makeCombo()],
    dishModifiers: {},
    dishAddons: {},
    ...overrides,
  }
}

describe('reconcileCart', () => {
  it('passes through unchanged items', () => {
    const items = [makeCartItem()]
    const menu = makeMenu()

    const result = reconcileCart(items, menu)

    expect(result.items).toHaveLength(1)
    expect(result.removed).toHaveLength(0)
    expect(result.updated).toHaveLength(0)
  })

  it('removes items whose dish is no longer in menu', () => {
    const items = [makeCartItem({ dishId: 'deleted-dish' })]
    const menu = makeMenu()

    const result = reconcileCart(items, menu)

    expect(result.items).toHaveLength(0)
    expect(result.removed).toHaveLength(1)
    expect(result.removed[0].item.dishId).toBe('deleted-dish')
    expect(result.removed[0].reason).toBe('dish_missing')
  })

  it('removes items with null dishId (non-combo)', () => {
    const items = [makeCartItem({ dishId: null })]
    const menu = makeMenu()

    const result = reconcileCart(items, menu)

    expect(result.items).toHaveLength(0)
    expect(result.removed).toHaveLength(1)
    expect(result.removed[0].reason).toBe('dish_missing')
  })

  describe('combo items', () => {
    it('keeps combo item when combo exists in menu', () => {
      const comboItem = makeCartItem({
        comboId: 'combo-1',
        dishId: null,
        dishName: 'Комбо Обед',
        price: 999,
      })
      const menu = makeMenu()

      const result = reconcileCart([comboItem], menu)

      expect(result.items).toHaveLength(1)
      expect(result.removed).toHaveLength(0)
      expect(result.updated).toHaveLength(0)
    })

    it('removes combo item when combo is not in menu', () => {
      const comboItem = makeCartItem({
        comboId: 'deleted-combo',
        dishId: null,
        dishName: 'Удалённое комбо',
        price: 999,
      })
      const menu = makeMenu()

      const result = reconcileCart([comboItem], menu)

      expect(result.items).toHaveLength(0)
      expect(result.removed).toHaveLength(1)
      expect(result.removed[0].item.comboId).toBe('deleted-combo')
      expect(result.removed[0].reason).toBe('combo_missing')
    })

    it('updates combo price when changed', () => {
      const comboItem = makeCartItem({
        comboId: 'combo-1',
        dishId: null,
        dishName: 'Комбо Обед',
        price: 800,
      })
      const menu = makeMenu({
        combos: [makeCombo({ price: 999 })],
      })

      const result = reconcileCart([comboItem], menu)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].price).toBe(999)
      expect(result.updated).toHaveLength(1)
    })

    it('updates combo name and photo', () => {
      const comboItem = makeCartItem({
        comboId: 'combo-1',
        dishId: null,
        dishName: 'Old Name',
        photo: 'old.jpg',
        price: 999,
      })
      const menu = makeMenu({
        combos: [makeCombo({ name: 'New Name', photos: ['new.jpg'] })],
      })

      const result = reconcileCart([comboItem], menu)

      expect(result.items[0].dishName).toBe('New Name')
      expect(result.items[0].photo).toBe('new.jpg')
    })
  })

  describe('modifier validation', () => {
    it('removes item if modifier optionId is no longer available', () => {
      const items = [makeCartItem({
        modifiers: [
          { optionId: 'opt-gone', groupName: 'Соус', optionName: 'Кетчуп', priceDelta: 0 },
        ],
      })]
      const menu = makeMenu({
        dishModifiers: {
          'dish-1': [{
            groupId: 'g1',
            groupName: 'Соус',
            sortOrder: 0,
            options: [
              { optionId: 'opt-mustard', optionName: 'Горчица', groupId: 'g1', groupName: 'Соус', priceDelta: 0, weight: null, isDefault: false, sortOrder: 0 },
            ],
          }],
        },
      })

      const result = reconcileCart(items, menu)

      expect(result.items).toHaveLength(0)
      expect(result.removed).toHaveLength(1)
      expect(result.removed[0].reason).toBe('modifier_invalid')
    })

    it('keeps item if modifier optionId is still available', () => {
      const items = [makeCartItem({
        modifiers: [
          { optionId: 'opt-1', groupName: 'Соус', optionName: 'Кетчуп', priceDelta: 0 },
        ],
      })]
      const menu = makeMenu({
        dishModifiers: {
          'dish-1': [{
            groupId: 'g1',
            groupName: 'Соус',
            sortOrder: 0,
            options: [
              { optionId: 'opt-1', optionName: 'Кетчуп', groupId: 'g1', groupName: 'Соус', priceDelta: 0, weight: null, isDefault: false, sortOrder: 0 },
            ],
          }],
        },
      })

      const result = reconcileCart(items, menu)

      expect(result.items).toHaveLength(1)
      expect(result.removed).toHaveLength(0)
    })

    it('keeps item with modifier without optionId (legacy)', () => {
      const items = [makeCartItem({
        modifiers: [
          { groupName: 'Соус', optionName: 'Кетчуп', priceDelta: 0 },
        ],
      })]
      const menu = makeMenu()

      const result = reconcileCart(items, menu)

      expect(result.items).toHaveLength(1)
      expect(result.removed).toHaveLength(0)
    })

    it('updates modifier priceDelta and reports as price change', () => {
      const items = [makeCartItem({
        modifiers: [
          { optionId: 'opt-1', groupName: 'Соус', optionName: 'Кетчуп', priceDelta: 50 },
        ],
      })]
      const menu = makeMenu({
        dishModifiers: {
          'dish-1': [{
            groupId: 'g1',
            groupName: 'Соус',
            sortOrder: 0,
            options: [
              { optionId: 'opt-1', optionName: 'Кетчуп', groupId: 'g1', groupName: 'Соус', priceDelta: 100, weight: null, isDefault: false, sortOrder: 0 },
            ],
          }],
        },
      })

      const result = reconcileCart(items, menu)

      expect(result.items).toHaveLength(1)
      expect(result.items[0].modifiers[0].priceDelta).toBe(100)
      expect(result.updated).toHaveLength(1)
    })

    it('updates modifier cosmetic fields (name)', () => {
      const items = [makeCartItem({
        modifiers: [
          { optionId: 'opt-1', groupName: 'Old Group', optionName: 'Old Name', priceDelta: 0 },
        ],
      })]
      const menu = makeMenu({
        dishModifiers: {
          'dish-1': [{
            groupId: 'g1',
            groupName: 'New Group',
            sortOrder: 0,
            options: [
              { optionId: 'opt-1', optionName: 'New Name', groupId: 'g1', groupName: 'New Group', priceDelta: 0, weight: null, isDefault: false, sortOrder: 0 },
            ],
          }],
        },
      })

      const result = reconcileCart(items, menu)

      expect(result.items[0].modifiers[0].groupName).toBe('New Group')
      expect(result.items[0].modifiers[0].optionName).toBe('New Name')
      expect(result.updated).toHaveLength(0) // cosmetic only, no price change
    })
  })

  describe('addon validation', () => {
    it('removes item if addon is no longer available', () => {
      const items = [makeCartItem({
        addons: [{ addonId: 'addon-gone', addonName: 'Бекон', price: 100 }],
      })]
      const menu = makeMenu({
        dishAddons: {
          'dish-1': [
            { id: 'addon-other', name: 'Сыр', price: 80, weight: null, order: 0 },
          ],
        },
      })

      const result = reconcileCart(items, menu)

      expect(result.items).toHaveLength(0)
      expect(result.removed).toHaveLength(1)
      expect(result.removed[0].reason).toBe('addon_invalid')
    })

    it('keeps item if addon is still available', () => {
      const items = [makeCartItem({
        addons: [{ addonId: 'addon-1', addonName: 'Бекон', price: 100 }],
      })]
      const menu = makeMenu({
        dishAddons: {
          'dish-1': [
            { id: 'addon-1', name: 'Бекон', price: 100, weight: null, order: 0 },
          ],
        },
      })

      const result = reconcileCart(items, menu)

      expect(result.items).toHaveLength(1)
      expect(result.removed).toHaveLength(0)
    })

    it('updates addon price and reports as price change', () => {
      const items = [makeCartItem({
        addons: [{ addonId: 'addon-1', addonName: 'Бекон', price: 100 }],
      })]
      const menu = makeMenu({
        dishAddons: {
          'dish-1': [
            { id: 'addon-1', name: 'Бекон', price: 150, weight: null, order: 0 },
          ],
        },
      })

      const result = reconcileCart(items, menu)

      expect(result.items[0].addons[0].price).toBe(150)
      expect(result.updated).toHaveLength(1)
    })

    it('updates addon name without reporting as price change', () => {
      const items = [makeCartItem({
        addons: [{ addonId: 'addon-1', addonName: 'Old Bacon', price: 100 }],
      })]
      const menu = makeMenu({
        dishAddons: {
          'dish-1': [
            { id: 'addon-1', name: 'New Bacon', price: 100, weight: null, order: 0 },
          ],
        },
      })

      const result = reconcileCart(items, menu)

      expect(result.items[0].addons[0].addonName).toBe('New Bacon')
      expect(result.updated).toHaveLength(0)
    })
  })

  describe('price updates', () => {
    it('updates dish base price and reports as price change', () => {
      const items = [makeCartItem({ price: 500 })]
      const menu = makeMenu({
        dishes: [makeDish({ price: 600 })],
      })

      const result = reconcileCart(items, menu)

      expect(result.items[0].price).toBe(600)
      expect(result.updated).toHaveLength(1)
    })

    it('does not report unchanged price', () => {
      const items = [makeCartItem({ price: 500 })]
      const menu = makeMenu({
        dishes: [makeDish({ price: 500 })],
      })

      const result = reconcileCart(items, menu)

      expect(result.updated).toHaveLength(0)
    })
  })

  describe('cosmetic updates', () => {
    it('updates dish name', () => {
      const items = [makeCartItem({ dishName: 'Old Name' })]
      const menu = makeMenu({
        dishes: [makeDish({ name: 'New Name' })],
      })

      const result = reconcileCart(items, menu)

      expect(result.items[0].dishName).toBe('New Name')
      expect(result.updated).toHaveLength(0) // cosmetic only
    })

    it('updates photo from first photos[]', () => {
      const items = [makeCartItem({ photo: 'old.jpg' })]
      const menu = makeMenu({
        dishes: [makeDish({ photos: ['new.jpg', 'other.jpg'] })],
      })

      const result = reconcileCart(items, menu)

      expect(result.items[0].photo).toBe('new.jpg')
    })

    it('sets photo to null when photos is empty', () => {
      const items = [makeCartItem({ photo: 'old.jpg' })]
      const menu = makeMenu({
        dishes: [makeDish({ photos: [] })],
      })

      const result = reconcileCart(items, menu)

      expect(result.items[0].photo).toBeNull()
    })
  })

  describe('removedIngredients', () => {
    it('keeps removed ingredients still present in dish', () => {
      const items = [makeCartItem({ removedIngredients: ['Лук', 'Томат'] })]
      const menu = makeMenu()

      const result = reconcileCart(items, menu)

      expect(result.items[0].removedIngredients).toEqual(['Лук', 'Томат'])
    })

    it('filters out removed ingredients no longer in dish', () => {
      const items = [makeCartItem({ removedIngredients: ['Лук', 'Удалённый'] })]
      const menu = makeMenu()

      const result = reconcileCart(items, menu)

      expect(result.items[0].removedIngredients).toEqual(['Лук'])
    })

    it('returns empty array when all removed ingredients are gone', () => {
      const items = [makeCartItem({ removedIngredients: ['Gone1', 'Gone2'] })]
      const menu = makeMenu()

      const result = reconcileCart(items, menu)

      expect(result.items[0].removedIngredients).toEqual([])
    })
  })

  describe('multiple items', () => {
    it('handles mix of valid, removed, and updated items', () => {
      const items = [
        makeCartItem({ dishId: 'dish-1', price: 500 }), // unchanged
        makeCartItem({ dishId: 'dish-2', price: 300 }), // will be removed (not in menu)
        makeCartItem({ dishId: 'dish-3', price: 400 }), // price changed
        makeCartItem({ comboId: 'combo-1', dishId: null, price: 999 }), // combo exists
        makeCartItem({ comboId: 'combo-gone', dishId: null, price: 500 }), // combo removed
      ]

      const menu = makeMenu({
        dishes: [
          makeDish({ id: 'dish-1', price: 500 }),
          makeDish({ id: 'dish-3', name: 'Pizza', price: 450, photos: ['pizza.jpg'], ingredients: [] }),
        ],
      })

      const result = reconcileCart(items, menu)

      expect(result.items).toHaveLength(3) // dish-1, dish-3, combo-1
      expect(result.removed).toHaveLength(2) // dish-2 + combo-gone
      expect(result.removed[0].item.dishId).toBe('dish-2')
      expect(result.removed[0].reason).toBe('dish_missing')
      expect(result.removed[1].item.comboId).toBe('combo-gone')
      expect(result.removed[1].reason).toBe('combo_missing')
      expect(result.updated).toHaveLength(1) // dish-3 price changed
      expect(result.updated[0].dishId).toBe('dish-3')
      expect(result.updated[0].price).toBe(450)
    })
  })

  describe('edge cases', () => {
    it('returns empty result for empty cart', () => {
      const result = reconcileCart([], makeMenu())

      expect(result.items).toEqual([])
      expect(result.removed).toEqual([])
      expect(result.updated).toEqual([])
    })

    it('handles dish with no modifiers record (undefined in map)', () => {
      const items = [makeCartItem({
        modifiers: [],
      })]
      // dishModifiers doesn't have dish-1 key
      const menu = makeMenu({ dishModifiers: {} })

      const result = reconcileCart(items, menu)

      expect(result.items).toHaveLength(1)
    })

    it('handles dish with no addons record (undefined in map)', () => {
      const items = [makeCartItem({
        addons: [],
      })]
      const menu = makeMenu({ dishAddons: {} })

      const result = reconcileCart(items, menu)

      expect(result.items).toHaveLength(1)
    })

    it('item in updated array is same reference as in items array', () => {
      const items = [makeCartItem({ price: 500 })]
      const menu = makeMenu({ dishes: [makeDish({ price: 600 })] })

      const result = reconcileCart(items, menu)

      expect(result.items[0]).toBe(result.updated[0])
    })
  })
})

// ──────────────────────────────────────────────────────────────────────────
// reconcileServices
// ──────────────────────────────────────────────────────────────────────────

function makeServiceItem(overrides: Partial<ReconcileServiceItem> = {}): ReconcileServiceItem {
  return {
    _key: 'svc-key-1',
    serviceId: 'svc-1',
    serviceName: 'Стрижка',
    price: 1000,
    duration: 60,
    photo: 'p.jpg',
    preferredResourceId: null,
    allowResourceChoice: true,
    branchId: null,
    ...overrides,
  }
}

function makeService(overrides: Partial<ReconcileService> = {}): ReconcileService {
  return {
    id: 'svc-1',
    name: 'Стрижка',
    price: 1000,
    duration: 60,
    photos: ['p.jpg'],
    isBookable: true,
    allowResourceChoice: true,
    ...overrides,
  }
}

describe('reconcileServices', () => {
  it('passes through unchanged services', () => {
    const result = reconcileServices([makeServiceItem()], [makeService()])

    expect(result.items).toHaveLength(1)
    expect(result.removed).toHaveLength(0)
    expect(result.updated).toHaveLength(0)
  })

  it('preserves _key — критично для cart.patchByKey', () => {
    const item = makeServiceItem({ _key: 'must-survive' })
    const result = reconcileServices([item], [makeService({ price: 1500 })])

    expect(result.items[0]._key).toBe('must-survive')
  })

  describe('removal', () => {
    it('removes service when serviceId is missing from catalog', () => {
      const result = reconcileServices(
        [makeServiceItem({ serviceId: 'gone' })],
        [makeService()],
      )

      expect(result.items).toHaveLength(0)
      expect(result.removed).toHaveLength(1)
      expect(result.removed[0].reason).toBe('service_missing')
      expect(result.removed[0].item.serviceId).toBe('gone')
    })

    it('removes service when isBookable=false (онлайн-запись отключена)', () => {
      const result = reconcileServices(
        [makeServiceItem()],
        [makeService({ isBookable: false })],
      )

      expect(result.items).toHaveLength(0)
      expect(result.removed).toHaveLength(1)
      expect(result.removed[0].reason).toBe('service_not_bookable')
    })

    it('пустой каталог — все services помечены как missing', () => {
      const result = reconcileServices(
        [makeServiceItem({ serviceId: 'a' }), makeServiceItem({ _key: 'k2', serviceId: 'b' })],
        [],
      )

      expect(result.items).toHaveLength(0)
      expect(result.removed).toHaveLength(2)
      expect(result.removed.every((r) => r.reason === 'service_missing')).toBe(true)
    })
  })

  describe('updates', () => {
    it('меняет price → попадает в updated', () => {
      const result = reconcileServices(
        [makeServiceItem({ price: 1000 })],
        [makeService({ price: 1500 })],
      )

      expect(result.items[0].price).toBe(1500)
      expect(result.updated).toHaveLength(1)
    })

    it('меняет duration → попадает в updated', () => {
      const result = reconcileServices(
        [makeServiceItem({ duration: 60 })],
        [makeService({ duration: 90 })],
      )

      expect(result.items[0].duration).toBe(90)
      expect(result.updated).toHaveLength(1)
    })

    it('меняет name → попадает в updated', () => {
      const result = reconcileServices(
        [makeServiceItem({ serviceName: 'Old' })],
        [makeService({ name: 'New' })],
      )

      expect(result.items[0].serviceName).toBe('New')
      expect(result.updated).toHaveLength(1)
    })

    it('меняет photo на первое из photos[]', () => {
      const result = reconcileServices(
        [makeServiceItem({ photo: 'old.jpg' })],
        [makeService({ photos: ['new.jpg', 'second.jpg'] })],
      )

      expect(result.items[0].photo).toBe('new.jpg')
      expect(result.updated).toHaveLength(1)
    })

    it('photo=null когда photos[] пустой', () => {
      const result = reconcileServices(
        [makeServiceItem({ photo: 'old.jpg' })],
        [makeService({ photos: [] })],
      )

      expect(result.items[0].photo).toBeNull()
    })
  })

  describe('preferredResourceId / allowResourceChoice', () => {
    it('сбрасывает preferredResourceId если allowResourceChoice стало false', () => {
      const result = reconcileServices(
        [makeServiceItem({ preferredResourceId: 'res-1', allowResourceChoice: true })],
        [makeService({ allowResourceChoice: false })],
      )

      expect(result.items[0].preferredResourceId).toBeNull()
      expect(result.items[0].allowResourceChoice).toBe(false)
      expect(result.updated).toHaveLength(1)
    })

    it('сохраняет preferredResourceId если allowResourceChoice=true и нет других расхождений', () => {
      const result = reconcileServices(
        [makeServiceItem({ preferredResourceId: 'res-1' })],
        [makeService({ allowResourceChoice: true })],
      )

      expect(result.items[0].preferredResourceId).toBe('res-1')
      expect(result.updated).toHaveLength(0)
    })

    it('синхронизирует флаг allowResourceChoice если расходится со снапшотом', () => {
      const result = reconcileServices(
        [makeServiceItem({ allowResourceChoice: false, preferredResourceId: null })],
        [makeService({ allowResourceChoice: true })],
      )

      expect(result.items[0].allowResourceChoice).toBe(true)
      // флаг изменился, но preferredResourceId как был null остаётся null — это считается изменением
      expect(result.updated).toHaveLength(0)
    })
  })

  describe('multiple items', () => {
    it('mix valid + removed + updated', () => {
      const items = [
        makeServiceItem({ _key: 'k1', serviceId: 's1' }), // unchanged
        makeServiceItem({ _key: 'k2', serviceId: 's2', price: 500 }), // price changed
        makeServiceItem({ _key: 'k3', serviceId: 'gone' }), // removed
        makeServiceItem({ _key: 'k4', serviceId: 's4' }), // not bookable
      ]
      const services = [
        makeService({ id: 's1' }),
        makeService({ id: 's2', price: 800 }),
        makeService({ id: 's4', isBookable: false }),
      ]

      const result = reconcileServices(items, services)

      expect(result.items).toHaveLength(2)
      expect(result.items.map((i) => i.serviceId)).toEqual(['s1', 's2'])
      expect(result.updated).toHaveLength(1)
      expect(result.updated[0].serviceId).toBe('s2')
      expect(result.updated[0].price).toBe(800)
      expect(result.removed).toHaveLength(2)
      expect(result.removed.map((r) => r.reason)).toEqual(['service_missing', 'service_not_bookable'])
    })

    it('сохраняет порядок входных items в результате', () => {
      const items = [
        makeServiceItem({ _key: 'a', serviceId: 's3' }),
        makeServiceItem({ _key: 'b', serviceId: 's1' }),
        makeServiceItem({ _key: 'c', serviceId: 's2' }),
      ]
      const services = [makeService({ id: 's1' }), makeService({ id: 's2' }), makeService({ id: 's3' })]

      const result = reconcileServices(items, services)

      expect(result.items.map((i) => i._key)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('edge cases', () => {
    it('пустые items — пустой результат', () => {
      const result = reconcileServices([], [makeService()])

      expect(result.items).toEqual([])
      expect(result.removed).toEqual([])
      expect(result.updated).toEqual([])
    })

    it('updated is same reference as in items', () => {
      const result = reconcileServices(
        [makeServiceItem({ price: 100 })],
        [makeService({ price: 200 })],
      )

      expect(result.items[0]).toBe(result.updated[0])
    })
  })
})
