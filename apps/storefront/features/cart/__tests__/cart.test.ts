import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { reconcileCart, reconcileServices } from '@fastio/shared'
import type { ReconcileMenuData, ReconcileService } from '@fastio/shared'
import {
  useCartStore,
  isDishItem,
  isServiceItem,
  type DishCartItem,
  type ServiceCartItem,
} from '../stores/cart'

vi.mock('@fastio/shared/observability', () => ({ reportError: vi.fn() }))

// --- helpers ---

const makeDish = (overrides: Partial<DishCartItem> = {}): DishCartItem => ({
  kind: 'dish',
  _key: 'k1',
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

const makeService = (overrides: Partial<ServiceCartItem> = {}): ServiceCartItem => ({
  kind: 'service',
  _key: 'sk1',
  serviceId: 'svc-1',
  serviceName: 'Стрижка',
  price: 1000,
  duration: 60,
  photo: null,
  preferredResourceId: null,
  allowResourceChoice: true,
  branchId: null,
  ...overrides,
})

describe('useCartStore', () => {
  let store: ReturnType<typeof useCartStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    localStorage.clear()
    store = useCartStore()
    store.restored = true
  })

  afterEach(() => {
    localStorage.clear()
  })

  // --- add() ---

  describe('add() — dish', () => {
    it('появляется в dishItems, не в serviceItems', () => {
      store.add(makeDish())
      expect(store.dishItems).toHaveLength(1)
      expect(store.serviceItems).toHaveLength(0)
    })

    it('то же блюдо (dishId + modifiers + addons + removedIngredients) — суммирует quantity', () => {
      store.add(makeDish({ quantity: 1 }))
      store.add(makeDish({ quantity: 2 }))
      expect(store.dishItems).toHaveLength(1)
      expect(store.dishItems[0].quantity).toBe(3)
    })

    it('блюдо с другими модификаторами — отдельная позиция', () => {
      store.add(makeDish({ modifiers: [] }))
      store.add(makeDish({
        modifiers: [{ optionId: 'opt1', optionName: 'Большой', groupName: 'Размер', priceDelta: 100 }],
      }))
      expect(store.dishItems).toHaveLength(2)
    })

    it('блюдо с другими addons — отдельная позиция', () => {
      store.add(makeDish({ addons: [] }))
      store.add(makeDish({ addons: [{ addonId: 'a1', addonName: 'Соус', price: 50 }] }))
      expect(store.dishItems).toHaveLength(2)
    })

    it('блюдо с другими removedIngredients — отдельная позиция', () => {
      store.add(makeDish({ removedIngredients: [] }))
      store.add(makeDish({ removedIngredients: ['лук'] }))
      expect(store.dishItems).toHaveLength(2)
    })
  })

  describe('add() — service', () => {
    it('появляется в serviceItems, не в dishItems', () => {
      store.add(makeService())
      expect(store.serviceItems).toHaveLength(1)
      expect(store.dishItems).toHaveLength(0)
    })

    it('та же услуга (serviceId) дважды — no-op', () => {
      store.add(makeService({ serviceId: 'svc-1' }))
      store.add(makeService({ serviceId: 'svc-1' }))
      expect(store.serviceItems).toHaveLength(1)
    })

    it('разные услуги — обе в корзине', () => {
      store.add(makeService({ serviceId: 'svc-1' }))
      store.add(makeService({ serviceId: 'svc-2' }))
      expect(store.serviceItems).toHaveLength(2)
    })
  })

  describe('add() — guard', () => {
    it('до restore() операция игнорируется', () => {
      store.restored = false
      store.add(makeDish())
      expect(store.items).toHaveLength(0)
    })
  })

  // --- computed ---

  describe('computed aggregates', () => {
    it('dishItems и serviceItems — независимые списки', () => {
      store.add(makeDish({ dishId: 'd1' }))
      store.add(makeDish({ dishId: 'd2' }))
      store.add(makeService({ serviceId: 'svc-1' }))
      expect(store.dishItems).toHaveLength(2)
      expect(store.serviceItems).toHaveLength(1)
    })

    it('count = dishCount + serviceCount', () => {
      store.add(makeDish({ quantity: 3 }))
      store.add(makeService())
      expect(store.dishCount).toBe(3)
      expect(store.serviceCount).toBe(1)
      expect(store.count).toBe(4)
    })

    it('subtotal учитывает цену блюд с модификаторами и аддонами', () => {
      store.add(makeDish({
        price: 500,
        quantity: 2,
        modifiers: [{ optionId: 'o', optionName: 'M', groupName: 'G', priceDelta: 100 }],
        addons: [{ addonId: 'a', addonName: 'Соус', price: 50 }],
      }))
      // unit = 500 + 100 + 50 = 650; × 2 = 1300
      expect(store.dishSubtotal).toBe(1300)
    })

    it('serviceSubtotal — сумма цен услуг', () => {
      store.add(makeService({ serviceId: 'svc-1', price: 1000 }))
      store.add(makeService({ serviceId: 'svc-2', price: 500 }))
      expect(store.serviceSubtotal).toBe(1500)
    })

    it('totalServiceDuration — сумма длительностей', () => {
      store.add(makeService({ serviceId: 'svc-1', duration: 60 }))
      store.add(makeService({ serviceId: 'svc-2', duration: 45 }))
      expect(store.totalServiceDuration).toBe(105)
    })
  })

  // --- increment / decrement / remove ---

  describe('increment / decrement / remove', () => {
    it('increment увеличивает quantity dish', () => {
      store.add(makeDish())
      store.increment(0)
      expect(store.dishItems[0].quantity).toBe(2)
    })

    it('decrement уменьшает quantity', () => {
      store.add(makeDish({ quantity: 3 }))
      store.decrement(0)
      expect(store.dishItems[0].quantity).toBe(2)
    })

    it('decrement до 0 — удаляет позицию', () => {
      store.add(makeDish({ quantity: 1 }))
      store.decrement(0)
      expect(store.items).toHaveLength(0)
    })

    it('increment / decrement на service-item — no-op', () => {
      store.add(makeService())
      store.increment(0)
      store.decrement(0)
      expect(store.serviceItems).toHaveLength(1)
    })

    it('remove удаляет по индексу, не трогает остальные', () => {
      store.add(makeDish({ dishId: 'd1' }))
      store.add(makeDish({ dishId: 'd2' }))
      store.remove(0)
      expect(store.items).toHaveLength(1)
      expect((store.items[0] as DishCartItem).dishId).toBe('d2')
    })

    it('setQuantity ставит конкретное значение', () => {
      store.add(makeDish({ quantity: 1 }))
      store.setQuantity(0, 5)
      expect(store.dishItems[0].quantity).toBe(5)
    })

    it('setQuantity(0) удаляет позицию', () => {
      store.add(makeDish())
      store.setQuantity(0, 0)
      expect(store.items).toHaveLength(0)
    })
  })

  // --- replace ---

  describe('replace()', () => {
    it('обновляет данные, сохраняет _key', () => {
      store.add(makeDish({ price: 500 }))
      const originalKey = store.items[0]._key
      store.replace(0, makeDish({ price: 700, _key: 'ignored-key' }))
      expect(store.items[0].price).toBe(700)
      expect(store.items[0]._key).toBe(originalKey)
    })

    it('kind mismatch — логирует ошибку и не меняет item', async () => {
      const { reportError } = await import('@fastio/shared/observability')
      store.add(makeDish())
      store.replace(0, makeService())
      expect(store.items[0].kind).toBe('dish')
      expect(reportError).toHaveBeenCalledOnce()
    })
  })

  // --- patchByKey ---

  describe('patchByKey()', () => {
    it('обновляет item по _key', () => {
      store.add(makeDish({ price: 500 }))
      const key = store.items[0]._key
      store.patchByKey([{ ...makeDish({ price: 700 }), _key: key }])
      expect(store.items[0].price).toBe(700)
      expect(store.items[0]._key).toBe(key)
    })

    it('items без совпадения по _key — удаляются', () => {
      store.add(makeDish({ dishId: 'd1' }))
      store.add(makeService({ serviceId: 'svc-1' }))
      const dishKey = store.dishItems[0]._key
      store.patchByKey([{ ...makeDish(), _key: dishKey }])
      expect(store.dishItems).toHaveLength(1)
      expect(store.serviceItems).toHaveLength(0) // не вошёл в newItems → удалён
    })

    it('новые items (неизвестный _key) добавляются в конец', () => {
      store.add(makeDish())
      const newSvc = makeService({ serviceId: 'new-svc', _key: 'new-key' })
      const existingKey = store.items[0]._key
      store.patchByKey([{ ...makeDish(), _key: existingKey }, newSvc])
      expect(store.items).toHaveLength(2)
      expect(store.items[1]._key).toBe('new-key')
    })

    it('порядок существующих items сохраняется', () => {
      store.add(makeDish({ dishId: 'd1' }))
      store.add(makeService({ serviceId: 'svc-1' }))
      const [k0, k1] = store.items.map((i) => i._key)
      store.patchByKey([
        { ...makeService({ serviceId: 'svc-1' }), _key: k1 },
        { ...makeDish({ dishId: 'd1' }), _key: k0 },
      ])
      // Порядок определяется старым store, не порядком аргументов patchByKey
      expect(store.items[0]._key).toBe(k0)
      expect(store.items[1]._key).toBe(k1)
    })
  })

  // --- clearDishes / clearServices ---

  describe('clearDishes() — изоляция и snapshot', () => {
    it('не трогает serviceItems', () => {
      store.add(makeDish())
      store.add(makeService())
      store.clearDishes()()
      expect(store.dishItems).toHaveLength(0)
      expect(store.serviceItems).toHaveLength(1)
    })

    it('snapshot: позиция добавленная после snapshot не стирается', () => {
      store.add(makeDish({ dishId: 'd1' }))
      const commit = store.clearDishes() // snapshot содержит только d1
      store.add(makeDish({ dishId: 'd2' })) // добавлено после snapshot
      commit()
      // d1 удалён, d2 (новый _key, не в snapshot) — остался
      expect(store.dishItems).toHaveLength(1)
      expect(store.dishItems[0].dishId).toBe('d2')
    })
  })

  describe('clearServices() — изоляция и snapshot', () => {
    it('не трогает dishItems', () => {
      store.add(makeDish())
      store.add(makeService())
      store.clearServices()()
      expect(store.serviceItems).toHaveLength(0)
      expect(store.dishItems).toHaveLength(1)
    })

    it('snapshot: услуга добавленная после snapshot не стирается', () => {
      store.add(makeService({ serviceId: 'svc-1' }))
      const commit = store.clearServices()
      store.add(makeService({ serviceId: 'svc-2' }))
      commit()
      expect(store.serviceItems).toHaveLength(1)
      expect(store.serviceItems[0].serviceId).toBe('svc-2')
    })
  })

  // --- removeService / setPreferredResource / clear ---

  describe('removeService()', () => {
    it('удаляет по serviceId, не трогает остальные', () => {
      store.add(makeService({ serviceId: 'svc-1' }))
      store.add(makeService({ serviceId: 'svc-2' }))
      store.removeService('svc-1')
      expect(store.serviceItems.map((i) => i.serviceId)).toEqual(['svc-2'])
    })
  })

  describe('setPreferredResource()', () => {
    it('обновляет preferredResourceId и возвращает true', () => {
      store.add(makeService({ serviceId: 'svc-1', preferredResourceId: null }))
      const ok = store.setPreferredResource('svc-1', 'res-42')
      expect(ok).toBe(true)
      expect(store.serviceItems[0].preferredResourceId).toBe('res-42')
    })

    it('несуществующий serviceId — возвращает false, ничего не меняет', () => {
      store.add(makeService({ serviceId: 'svc-1' }))
      const ok = store.setPreferredResource('ghost', 'res-42')
      expect(ok).toBe(false)
      expect(store.serviceItems[0].preferredResourceId).toBeNull()
    })
  })

  describe('clear()', () => {
    it('очищает все items', () => {
      store.add(makeDish())
      store.add(makeService())
      store.clear()
      expect(store.items).toHaveLength(0)
    })
  })

  // --- persist / restore ---

  describe('persist / restore', () => {
    it('persist + restore — блюдо восстанавливается без потерь', () => {
      store.add(makeDish({ dishId: 'test-dish', price: 750, quantity: 2 }))

      setActivePinia(createPinia())
      const store2 = useCartStore()
      store2.restore()

      expect(store2.dishItems).toHaveLength(1)
      expect(store2.dishItems[0].dishId).toBe('test-dish')
      expect(store2.dishItems[0].price).toBe(750)
      expect(store2.dishItems[0].quantity).toBe(2)
      expect(store2.restored).toBe(true)
    })

    it('persist + restore — услуга восстанавливается без потерь', () => {
      store.add(makeService({ serviceId: 'svc-restore', price: 1500, duration: 90 }))

      setActivePinia(createPinia())
      const store2 = useCartStore()
      store2.restore()

      expect(store2.serviceItems).toHaveLength(1)
      expect(store2.serviceItems[0].serviceId).toBe('svc-restore')
      expect(store2.serviceItems[0].price).toBe(1500)
      expect(store2.serviceItems[0].duration).toBe(90)
    })

    it('persist сохраняет оба типа, restore восстанавливает оба', () => {
      store.add(makeDish({ dishId: 'd-mix' }))
      store.add(makeService({ serviceId: 'svc-mix' }))

      setActivePinia(createPinia())
      const store2 = useCartStore()
      store2.restore()

      expect(store2.dishItems).toHaveLength(1)
      expect(store2.serviceItems).toHaveLength(1)
    })

    it('legacy migration: item без kind → dish с дефолтами addons/removedIngredients', () => {
      localStorage.setItem('cart', JSON.stringify([{
        dishId: 'd-legacy',
        comboId: null,
        dishName: 'Старое блюдо',
        categoryName: null,
        price: 300,
        quantity: 2,
        // нет kind, нет addons, нет removedIngredients, нет _key
        completedAt: null,
        comboItems: null,
        addedBy: null,
        confirmedBy: null,
        status: 'pending',
      }]))

      setActivePinia(createPinia())
      const store2 = useCartStore()
      store2.restore()

      expect(store2.items).toHaveLength(1)
      expect(store2.items[0].kind).toBe('dish')
      const dish = store2.items[0] as DishCartItem
      expect(dish.addons).toEqual([])
      expect(dish.removedIngredients).toEqual([])
      expect(dish.modifiers).toEqual([])
      expect(dish._key).toBeTruthy()
    })

    it('legacy migration: item без kind сохраняет quantity и modifiers если есть', () => {
      localStorage.setItem('cart', JSON.stringify([{
        dishId: 'd-legacy',
        comboId: null,
        dishName: 'Блюдо',
        categoryName: null,
        price: 300,
        quantity: 5,
        modifiers: [{ optionId: 'o1', optionName: 'М', groupId: 'g1', groupName: 'G', priceDelta: 50 }],
        completedAt: null,
        comboItems: null,
        addedBy: null,
        confirmedBy: null,
        status: 'pending',
      }]))

      setActivePinia(createPinia())
      const store2 = useCartStore()
      store2.restore()

      const dish = store2.items[0] as DishCartItem
      expect(dish.quantity).toBe(5)
      expect(dish.modifiers).toHaveLength(1)
    })

    it('invalid kind пропускается при restore', () => {
      localStorage.setItem('cart', JSON.stringify([
        { kind: 'garbage', dishId: 'd1', price: 100 },
        { kind: null, dishId: 'd2', price: 200 },
        makeDish({ kind: 'dish' }),
      ]))

      setActivePinia(createPinia())
      const store2 = useCartStore()
      store2.restore()

      expect(store2.items).toHaveLength(1)
      expect(store2.items[0].kind).toBe('dish')
    })

    it('broken JSON в localStorage — не падает, корзина пустая, restored=true', () => {
      localStorage.setItem('cart', '{{invalid-json')

      setActivePinia(createPinia())
      const store2 = useCartStore()
      store2.restore()

      expect(store2.items).toHaveLength(0)
      expect(store2.restored).toBe(true)
    })

    it('пустой localStorage — restored=true, items=[]', () => {
      setActivePinia(createPinia())
      const store2 = useCartStore()
      store2.restore()

      expect(store2.items).toHaveLength(0)
      expect(store2.restored).toBe(true)
    })
  })

  // --- reconcile pipeline (purpose 1.4 — useCartReconciler) ---
  // Тестируем реальный пайплайн `reconcile* → patchByKey`, а не сам composable —
  // composable использует useNuxtData/useToast (Nuxt-зависимости), которые
  // пришлось бы мокать. Логика композабла = «вызвать reconcile, склеить,
  // patchByKey + warning'и». Здесь проверяем что склейка не теряет данные.

  describe('reconcile pipeline → patchByKey', () => {
    const makeMenu = (dishId = 'd1', price = 500): ReconcileMenuData => ({
      dishes: [{ id: dishId, name: 'Пицца', price, photos: ['p.jpg'], ingredients: [] }],
      combos: [],
      dishModifiers: {},
      dishAddons: {},
    })

    const makeServiceCatalog = (
      id = 'svc-1',
      overrides: Partial<ReconcileService> = {},
    ): ReconcileService[] => [{
      id,
      name: 'Стрижка',
      price: 1000,
      duration: 60,
      photos: ['s.jpg'],
      isBookable: true,
      allowResourceChoice: true,
      ...overrides,
    }]

    it('reconcile только dishes — services в корзине не теряются', () => {
      // Регрессия: раньше replaceAll затирал services если в snapshot были только dishes
      store.add(makeDish({ dishId: 'd1', price: 500 }))
      store.add(makeService({ serviceId: 'svc-1' }))

      const dishResult = reconcileCart(
        store.dishItems.map((i) => ({ ...i })),
        makeMenu('d1', 600),
      )
      const reconciledDishes: DishCartItem[] = dishResult.items.map((i) => ({
        ...i,
        kind: 'dish' as const,
      }))

      // Имитация useCartReconciler: склеиваем dishes + текущие services
      store.patchByKey([...reconciledDishes, ...store.serviceItems])

      expect(store.dishItems).toHaveLength(1)
      expect(store.dishItems[0].price).toBe(600) // price обновился
      expect(store.serviceItems).toHaveLength(1) // service остался
      expect(store.serviceItems[0].serviceId).toBe('svc-1')
    })

    it('reconcile только services — dishes в корзине не теряются', () => {
      store.add(makeDish({ dishId: 'd1' }))
      store.add(makeService({ serviceId: 'svc-1', price: 1000 }))

      const svcResult = reconcileServices(
        store.serviceItems.map((i) => ({ ...i })),
        makeServiceCatalog('svc-1', { price: 1500 }),
      )
      const reconciledServices: ServiceCartItem[] = svcResult.items.map((i) => ({
        ...(i as ServiceCartItem),
        kind: 'service' as const,
      }))

      store.patchByKey([...store.dishItems, ...reconciledServices])

      expect(store.dishItems).toHaveLength(1)
      expect(store.serviceItems).toHaveLength(1)
      expect(store.serviceItems[0].price).toBe(1500)
    })

    it('reconcile удаляет dish, помеченный как missing — service остаётся', () => {
      store.add(makeDish({ dishId: 'd1' }))
      store.add(makeDish({ dishId: 'd-gone' }))
      store.add(makeService({ serviceId: 'svc-1' }))

      const dishResult = reconcileCart(
        store.dishItems.map((i) => ({ ...i })),
        makeMenu('d1', 500),
      )

      expect(dishResult.removed).toHaveLength(1)
      expect(dishResult.removed[0].reason).toBe('dish_missing')

      const reconciledDishes: DishCartItem[] = dishResult.items.map((i) => ({
        ...i,
        kind: 'dish' as const,
      }))
      store.patchByKey([...reconciledDishes, ...store.serviceItems])

      expect(store.dishItems).toHaveLength(1)
      expect(store.dishItems[0].dishId).toBe('d1')
      expect(store.serviceItems).toHaveLength(1) // не пострадал
    })

    it('reconcile удаляет service когда isBookable=false — dish не трогается', () => {
      store.add(makeDish({ dishId: 'd1' }))
      store.add(makeService({ serviceId: 'svc-1' }))

      const svcResult = reconcileServices(
        store.serviceItems.map((i) => ({ ...i })),
        makeServiceCatalog('svc-1', { isBookable: false }),
      )

      expect(svcResult.removed).toHaveLength(1)
      expect(svcResult.removed[0].reason).toBe('service_not_bookable')

      const reconciledServices: ServiceCartItem[] = svcResult.items.map((i) => ({
        ...(i as ServiceCartItem),
        kind: 'service' as const,
      }))
      store.patchByKey([...store.dishItems, ...reconciledServices])

      expect(store.dishItems).toHaveLength(1)
      expect(store.serviceItems).toHaveLength(0)
    })

    it('reconcile апдейт цены не сбрасывает quantity клиента', () => {
      store.add(makeDish({ dishId: 'd1', price: 500, quantity: 1 }))
      store.add(makeDish({ dishId: 'd1', price: 500, quantity: 2 })) // суммируется → quantity=3

      expect(store.dishItems[0].quantity).toBe(3)

      const dishResult = reconcileCart(
        store.dishItems.map((i) => ({ ...i })),
        makeMenu('d1', 700),
      )
      const reconciledDishes: DishCartItem[] = dishResult.items.map((i) => ({
        ...i,
        kind: 'dish' as const,
      }))
      store.patchByKey([...reconciledDishes, ...store.serviceItems])

      expect(store.dishItems[0].price).toBe(700)
      expect(store.dishItems[0].quantity).toBe(3) // quantity не тронут reconcile'ом
    })

    it('адресация по _key устойчива к перестановке порядка items', () => {
      // useCartEdit держит ссылку на _key открытой позиции; если reconcile сменил
      // индексы, модалка не должна получить stale-state
      store.add(makeDish({ dishId: 'd1' }))
      store.add(makeService({ serviceId: 'svc-1' }))
      const dishKey = store.dishItems[0]._key
      const serviceKey = store.serviceItems[0]._key

      const dishResult = reconcileCart(
        store.dishItems.map((i) => ({ ...i })),
        makeMenu('d1', 700), // price изменился
      )
      const svcResult = reconcileServices(
        store.serviceItems.map((i) => ({ ...i })),
        makeServiceCatalog('svc-1', { price: 1500 }),
      )

      // Подаём в обратном порядке: services сначала, dishes после
      store.patchByKey([
        ...svcResult.items.map((i) => ({ ...(i as ServiceCartItem), kind: 'service' as const })),
        ...dishResult.items.map((i) => ({ ...i, kind: 'dish' as const })),
      ])

      // _key позиций не меняется
      expect(store.dishItems[0]._key).toBe(dishKey)
      expect(store.serviceItems[0]._key).toBe(serviceKey)
      // и порядок items по _key — как был в store до patchByKey, не как в аргументе
      expect(store.items[0]._key).toBe(dishKey)
      expect(store.items[1]._key).toBe(serviceKey)
    })
  })

  // --- type guards ---

  describe('isDishItem / isServiceItem', () => {
    it('isDishItem: true для dish, false для service', () => {
      expect(isDishItem(makeDish())).toBe(true)
      expect(isDishItem(makeService())).toBe(false)
    })

    it('isServiceItem: true для service, false для dish', () => {
      expect(isServiceItem(makeService())).toBe(true)
      expect(isServiceItem(makeDish())).toBe(false)
    })
  })
})
