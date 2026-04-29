import { describe, it, expect } from 'vitest'
import { useDishCustomization } from '../useDishCustomization'
import type { DishModifierGroup } from '@fastio/shared'
import type { ClientAddon } from '../../stores/menu'

// --- Хелперы ---

const makeItem = (overrides = {}) => ({
  id: 'dish-1',
  name: 'Пицца',
  description: 'Вкусная',
  price: 500,
  photos: ['photo.jpg'],
  categoryName: 'Пиццы',
  ingredients: [{ name: 'сыр' }, { name: 'томат' }, { name: 'базилик' }],
  nutrition: { calories: 250, protein: 10, fat: 8, carbs: 30, weight: 300 },
  ...overrides,
})

const makeModifierGroup = (overrides: Partial<DishModifierGroup> & { options?: DishModifierGroup['options'] } = {}): DishModifierGroup => ({
  groupId: 'group-1',
  groupName: 'Размер',
  sortOrder: 0,
  options: [
    { optionId: 'opt-s', optionName: 'Маленькая', groupId: 'group-1', groupName: 'Размер', priceDelta: 0, isDefault: true, weight: null, sortOrder: 0, active: true },
    { optionId: 'opt-l', optionName: 'Большая', groupId: 'group-1', groupName: 'Размер', priceDelta: 150, isDefault: false, weight: null, sortOrder: 1, active: true },
  ],
  ...overrides,
})

const makeAddon = (id: string, name: string, price: number, order = 0): ClientAddon => ({ id, name, price, weight: null, order })

// --- Тесты ---

describe('useDishCustomization', () => {
  describe('инициализация модификаторов', () => {
    it('выбирается опция с isDefault=true', () => {
      const { selectedModifiers } = useDishCustomization({
        item: makeItem(),
        modifiers: [makeModifierGroup()],
        addons: [],
      })
      expect(selectedModifiers['group-1']).toBe('opt-s')
    })

    it('при отсутствии isDefault выбирается первая опция', () => {
      const group = makeModifierGroup({
        options: [
          { optionId: 'opt-1', optionName: 'Один', groupId: 'group-1', groupName: 'Размер', priceDelta: 0, isDefault: false, weight: null, sortOrder: 0, active: true },
          { optionId: 'opt-2', optionName: 'Два', groupId: 'group-1', groupName: 'Размер', priceDelta: 50, isDefault: false, weight: null, sortOrder: 1, active: true },
        ],
      })
      const { selectedModifiers } = useDishCustomization({ item: makeItem(), modifiers: [group], addons: [] })
      expect(selectedModifiers['group-1']).toBe('opt-1')
    })

    it('initialModifiers перезаписывает дефолт', () => {
      const { selectedModifiers } = useDishCustomization({
        item: makeItem(),
        modifiers: [makeModifierGroup()],
        addons: [],
        initialModifiers: [{ optionId: 'opt-l', groupName: 'Размер', optionName: 'Большая', priceDelta: 150 }],
      })
      expect(selectedModifiers['group-1']).toBe('opt-l')
    })

    it('несколько групп инициализируются независимо', () => {
      const groups = [
        makeModifierGroup({ groupId: 'g1', groupName: 'Размер' }),
        makeModifierGroup({
          groupId: 'g2',
          groupName: 'Тесто',
          options: [
            { optionId: 'thin', optionName: 'Тонкое', groupId: 'g2', groupName: 'Тесто', priceDelta: 0, isDefault: true, weight: null, sortOrder: 0, active: true },
            { optionId: 'thick', optionName: 'Толстое', groupId: 'g2', groupName: 'Тесто', priceDelta: 0, isDefault: false, weight: null, sortOrder: 1, active: true },
          ],
        }),
      ]
      const { selectedModifiers } = useDishCustomization({ item: makeItem(), modifiers: groups, addons: [] })
      expect(selectedModifiers['g1']).toBe('opt-s')
      expect(selectedModifiers['g2']).toBe('thin')
    })
  })

  describe('selectedModifierOptions', () => {
    it('возвращает выбранные модификаторы с priceDelta', () => {
      const { selectedModifiers, selectedModifierOptions } = useDishCustomization({
        item: makeItem(),
        modifiers: [makeModifierGroup()],
        addons: [],
      })
      selectedModifiers['group-1'] = 'opt-l'
      expect(selectedModifierOptions.value).toHaveLength(1)
      expect(selectedModifierOptions.value[0].optionName).toBe('Большая')
      expect(selectedModifierOptions.value[0].priceDelta).toBe(150)
    })
  })

  describe('unitPrice / totalPrice', () => {
    it('цена без модификаторов и аддонов', () => {
      const { unitPrice, totalPrice } = useDishCustomization({
        item: makeItem({ price: 500 }),
        modifiers: [],
        addons: [],
      })
      expect(unitPrice.value).toBe(500)
      expect(totalPrice.value).toBe(500)
    })

    it('цена с модификатором +150', () => {
      const { selectedModifiers, unitPrice } = useDishCustomization({
        item: makeItem({ price: 500 }),
        modifiers: [makeModifierGroup()],
        addons: [],
      })
      selectedModifiers['group-1'] = 'opt-l'
      expect(unitPrice.value).toBe(650)
    })

    it('цена с аддоном', () => {
      const { selectedAddonIds, unitPrice } = useDishCustomization({
        item: makeItem({ price: 500 }),
        modifiers: [],
        addons: [makeAddon('a1', 'Соус', 50)],
      })
      selectedAddonIds.value.add('a1')
      expect(unitPrice.value).toBe(550)
    })

    it('totalPrice = unitPrice * quantity', () => {
      const { quantity, unitPrice, totalPrice } = useDishCustomization({
        item: makeItem({ price: 300 }),
        modifiers: [],
        addons: [],
      })
      quantity.value = 3
      expect(totalPrice.value).toBe(unitPrice.value * 3)
    })
  })

  describe('canSelectMoreAddons / addonsCountLabel', () => {
    it('maxAddons=null → всегда можно добавить', () => {
      const { canSelectMoreAddons, selectedAddonIds } = useDishCustomization({
        item: makeItem(),
        modifiers: [],
        addons: [makeAddon('a1', 'Соус', 50), makeAddon('a2', 'Сыр', 70)],
        maxAddons: null,
      })
      selectedAddonIds.value.add('a1')
      selectedAddonIds.value.add('a2')
      expect(canSelectMoreAddons.value).toBe(true)
    })

    it('maxAddons=1: при выборе одного — нельзя добавить ещё', () => {
      const { canSelectMoreAddons, selectedAddonIds } = useDishCustomization({
        item: makeItem(),
        modifiers: [],
        addons: [makeAddon('a1', 'Соус', 50), makeAddon('a2', 'Сыр', 70)],
        maxAddons: 1,
      })
      expect(canSelectMoreAddons.value).toBe(true)
      selectedAddonIds.value.add('a1')
      expect(canSelectMoreAddons.value).toBe(false)
    })

    it('addonsCountLabel null если addons.length <= maxAddons', () => {
      const { addonsCountLabel } = useDishCustomization({
        item: makeItem(),
        modifiers: [],
        addons: [makeAddon('a1', 'Соус', 50)],
        maxAddons: 2,
      })
      expect(addonsCountLabel.value).toBeNull()
    })

    it('addonsCountLabel показывает "N из M" если аддонов больше лимита', () => {
      const { addonsCountLabel, selectedAddonIds } = useDishCustomization({
        item: makeItem(),
        modifiers: [],
        addons: [makeAddon('a1', 'Соус', 50), makeAddon('a2', 'Сыр', 70), makeAddon('a3', 'Лук', 30)],
        maxAddons: 2,
      })
      selectedAddonIds.value.add('a1')
      expect(addonsCountLabel.value).toBe('1 из 2')
    })
  })

  describe('displayNutrition', () => {
    it('без модификаторов с весом → стандартное nutrition', () => {
      const { displayNutrition } = useDishCustomization({
        item: makeItem(),
        modifiers: [makeModifierGroup()],
        addons: [],
      })
      expect(displayNutrition.value?.weight).toBe(300)
    })

    it('модификатор с weight → подменяет weight в nutrition', () => {
      const group = makeModifierGroup({
        options: [
          { optionId: 'opt-l', optionName: 'Большая', groupId: 'group-1', groupName: 'Размер', priceDelta: 150, isDefault: true, weight: 500, sortOrder: 0, active: true },
        ],
      })
      const { displayNutrition } = useDishCustomization({
        item: makeItem(),
        modifiers: [group],
        addons: [],
      })
      expect(displayNutrition.value?.weight).toBe(500)
      expect(displayNutrition.value?.calories).toBe(250) // остальное не меняется
    })

    it('nutrition=null → null', () => {
      const { displayNutrition } = useDishCustomization({
        item: makeItem({ nutrition: null }),
        modifiers: [],
        addons: [],
      })
      expect(displayNutrition.value).toBeNull()
    })
  })

  describe('buildCartItem', () => {
    it('собирает корзинный элемент', () => {
      const { buildCartItem } = useDishCustomization({
        item: makeItem(),
        modifiers: [],
        addons: [],
        initialQuantity: 2,
      })
      const cart = buildCartItem()
      if (cart.kind !== 'dish') throw new Error('expected dish item')
      expect(cart.dishId).toBe('dish-1')
      expect(cart.dishName).toBe('Пицца')
      expect(cart.price).toBe(500)
      expect(cart.quantity).toBe(2)
      expect(cart.photo).toBe('photo.jpg')
    })

    it('убранные ингредиенты попадают в cartItem', () => {
      const { removedSet, buildCartItem } = useDishCustomization({
        item: makeItem(),
        modifiers: [],
        addons: [],
      })
      removedSet.value.add('томат')
      const item = buildCartItem()
      if (item.kind !== 'dish') throw new Error('expected dish item')
      expect(item.removedIngredients).toContain('томат')
    })

    it('фото берётся из первого элемента photos', () => {
      const { buildCartItem } = useDishCustomization({
        item: makeItem({ photos: ['first.jpg', 'second.jpg'] }),
        modifiers: [],
        addons: [],
      })
      expect(buildCartItem().photo).toBe('first.jpg')
    })

    it('нет фото → photo=null', () => {
      const { buildCartItem } = useDishCustomization({
        item: makeItem({ photos: [] }),
        modifiers: [],
        addons: [],
      })
      expect(buildCartItem().photo).toBeNull()
    })
  })
})
