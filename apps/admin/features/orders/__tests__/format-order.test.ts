import { describe, it, expect } from 'vitest'
import { formatEventText, formatFieldValue } from '../utils/format-order'

describe('formatEventText', () => {
  describe('order_created', () => {
    it('источник storefront', () => {
      expect(formatEventText('order_created', { source: 'storefront' }))
        .toBe('Заказ создан (сторфронт)')
    })

    it('источник admin', () => {
      expect(formatEventText('order_created', { source: 'admin' }))
        .toBe('Заказ создан (администрация)')
    })

    it('неизвестный источник → fallback "администрация"', () => {
      expect(formatEventText('order_created', { source: 'unknown' }))
        .toBe('Заказ создан (администрация)')
    })

    it('source отсутствует → fallback "администрация"', () => {
      expect(formatEventText('order_created', {}))
        .toBe('Заказ создан (администрация)')
    })
  })

  describe('status_changed', () => {
    it('from_name и to_name через стрелку', () => {
      expect(formatEventText('status_changed', { from_name: 'Новый', to_name: 'Принят' }))
        .toBe('Новый → Принят')
    })

    it('fallback на id если name отсутствует', () => {
      expect(formatEventText('status_changed', { from_id: 'new', to_id: 'accepted' }))
        .toBe('new → accepted')
    })

    it('отсутствие обоих → "?"', () => {
      expect(formatEventText('status_changed', {}))
        .toBe('? → ?')
    })
  })

  describe('kitchen события', () => {
    it('kitchen_claimed с блюдом', () => {
      expect(formatEventText('kitchen_claimed', { dishName: 'Пицца' }))
        .toBe('взял в работу: Пицца')
    })

    it('kitchen_completed с блюдом', () => {
      expect(formatEventText('kitchen_completed', { dishName: 'Бургер' }))
        .toBe('приготовил: Бургер')
    })

    it('kitchen_returned с блюдом', () => {
      expect(formatEventText('kitchen_returned', { dishName: 'Суп' }))
        .toBe('вернул в очередь: Суп')
    })

    it('dishName отсутствует → "?"', () => {
      expect(formatEventText('kitchen_claimed', {}))
        .toBe('взял в работу: ?')
    })
  })

  describe('неизвестный тип события', () => {
    it('возвращает тип события как есть', () => {
      expect(formatEventText('some_unknown_event', {}))
        .toBe('some_unknown_event')
    })
  })
})

describe('formatFieldValue', () => {
  it('null → "—"', () => {
    expect(formatFieldValue('any', null)).toBe('—')
  })

  it('undefined → "—"', () => {
    expect(formatFieldValue('any', undefined)).toBe('—')
  })

  it('пустая строка → "—"', () => {
    expect(formatFieldValue('any', '')).toBe('—')
  })

  it('payment_type cash → "Наличные"', () => {
    expect(formatFieldValue('payment_type', 'cash')).toBe('Наличные')
  })

  it('payment_type card → "Карта при получении"', () => {
    expect(formatFieldValue('payment_type', 'card')).toBe('Карта при получении')
  })

  it('payment_type online → "Онлайн"', () => {
    expect(formatFieldValue('payment_type', 'online')).toBe('Онлайн')
  })

  it('delivery_type delivery → "Доставка"', () => {
    expect(formatFieldValue('delivery_type', 'delivery')).toBe('Доставка')
  })

  it('delivery_type pickup → "Самовывоз"', () => {
    expect(formatFieldValue('delivery_type', 'pickup')).toBe('Самовывоз')
  })

  it('delivery_fee → с символом рубля', () => {
    expect(formatFieldValue('delivery_fee', 200)).toBe('200 ₽')
  })

  it('произвольное поле → String(value)', () => {
    expect(formatFieldValue('comment', 'без лука')).toBe('без лука')
    expect(formatFieldValue('total', 1500)).toBe('1500')
  })
})
