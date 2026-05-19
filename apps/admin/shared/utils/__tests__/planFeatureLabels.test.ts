import { describe, it, expect } from 'vitest'
import type { Plan } from '@fastio/shared'
import { getPlanFeatureLabels, getPrevPlanName, getChangePlanConfirmText } from '../planFeatureLabels'

const makePlan = (overrides: Partial<Plan> = {}): Plan => ({
  id: 'plan-1',
  key: 'retail-start',
  businessType: 'retail',
  name: 'Старт',
  description: '',
  price: 1990,
  sortOrder: 1,
  isActive: true,
  features: {},
  badge: null,
  isFeatured: false,
  ...overrides,
})

describe('getPlanFeatureLabels', () => {
  describe('showcase-тариф', () => {
    it('retail showcase + food → возвращает базовые фичи витрины food', () => {
      const plan = makePlan({ key: 'retail-showcase', businessType: 'retail' })
      const labels = getPlanFeatureLabels(plan, 'food')

      expect(labels).toContain('Конструктор сайта')
      expect(labels).toContain('Каталог блюд')
      expect(labels).toContain('Кастомный домен')
      expect(labels).toContain('Тема и дизайн')
    })

    it('retail showcase + catalog → возвращает базовые фичи витрины catalog', () => {
      const plan = makePlan({ key: 'retail-showcase', businessType: 'retail' })
      const labels = getPlanFeatureLabels(plan, 'catalog')

      expect(labels).toContain('Каталог товаров')
      expect(labels).not.toContain('Каталог блюд')
    })

    it('services showcase → возвращает базовые фичи витрины services', () => {
      const plan = makePlan({ key: 'services-showcase', businessType: 'services' })
      const labels = getPlanFeatureLabels(plan)

      expect(labels).toContain('Каталог услуг')
      expect(labels).not.toContain('Каталог блюд')
    })

    it('showcase возвращает ровно 4 базовых фичи', () => {
      const plan = makePlan({ key: 'retail-showcase', businessType: 'retail' })
      const labels = getPlanFeatureLabels(plan, 'food')

      expect(labels).toHaveLength(4)
    })
  })

  describe('платные тарифы (start/pro)', () => {
    it('delivery=true → "Доставка" в лейблах', () => {
      const plan = makePlan({
        key: 'retail-start',
        features: { modules: { delivery: true } },
      })
      const labels = getPlanFeatureLabels(plan)

      expect(labels).toContain('Доставка')
    })

    it('delivery=false → "Доставка" не в лейблах', () => {
      const plan = makePlan({
        key: 'retail-start',
        features: { modules: { delivery: false } },
      })
      const labels = getPlanFeatureLabels(plan)

      expect(labels).not.toContain('Доставка')
    })

    it('telegramNotifications=true → "Уведомления в Telegram" в лейблах', () => {
      const plan = makePlan({
        key: 'retail-start',
        features: { site: { telegramNotifications: true } },
      })
      const labels = getPlanFeatureLabels(plan)

      expect(labels).toContain('Уведомления в Telegram')
    })

    it('virtualCategories=true → "Виртуальные категории"', () => {
      const plan = makePlan({
        key: 'retail-pro',
        features: { menu: { virtualCategories: true } },
      })
      const labels = getPlanFeatureLabels(plan)

      expect(labels).toContain('Виртуальные категории')
    })

    it('ingredients=true → "Состав блюд"', () => {
      const plan = makePlan({
        key: 'retail-pro',
        features: { menu: { ingredients: true } },
      })
      const labels = getPlanFeatureLabels(plan)

      expect(labels).toContain('Состав блюд')
    })

    it('resources.max=0 → "Без лимита ресурсов"', () => {
      const plan = makePlan({
        key: 'services-pro',
        features: { resources: { max: 0 } },
      })
      const labels = getPlanFeatureLabels(plan)

      expect(labels).toContain('Без лимита ресурсов')
    })

    it('resources.max=5 → "До 5 активных ресурсов"', () => {
      const plan = makePlan({
        key: 'services-start',
        features: { resources: { max: 5 } },
      })
      const labels = getPlanFeatureLabels(plan)

      expect(labels).toContain('До 5 активных ресурсов')
    })

    it('пустые features → пустой массив лейблов', () => {
      const plan = makePlan({ key: 'retail-start', features: {} })
      const labels = getPlanFeatureLabels(plan)

      expect(labels).toHaveLength(0)
    })

    it('несколько модулей → несколько лейблов', () => {
      const plan = makePlan({
        key: 'retail-pro',
        features: { modules: { delivery: true, pickup: true, kitchen: true } },
      })
      const labels = getPlanFeatureLabels(plan)

      expect(labels).toContain('Доставка')
      expect(labels).toContain('Самовывоз')
      expect(labels).toContain('Экран кухни (KDS)')
    })
  })
})

describe('getPrevPlanName', () => {
  const plans: Plan[] = [
    makePlan({ key: 'retail-showcase', name: 'Витрина', businessType: 'retail' }),
    makePlan({ key: 'retail-start', name: 'Старт', businessType: 'retail' }),
    makePlan({ key: 'retail-pro', name: 'Про', businessType: 'retail' }),
  ]

  it('showcase → нет предыдущего, возвращает null', () => {
    const plan = plans[0]

    expect(getPrevPlanName(plan, plans)).toBeNull()
  })

  it('start → предыдущий showcase — возвращает "Витрина"', () => {
    const plan = plans[1]

    expect(getPrevPlanName(plan, plans)).toBe('Витрина')
  })

  it('pro → предыдущий start — возвращает "Старт"', () => {
    const plan = plans[2]

    expect(getPrevPlanName(plan, plans)).toBe('Старт')
  })

  it('не смешивает businessType — services-start не находит retail-showcase', () => {
    const servicesPlan = makePlan({ key: 'services-start', name: 'Services Старт', businessType: 'services' })
    const result = getPrevPlanName(servicesPlan, plans)

    expect(result).toBeNull()
  })
})

describe('getChangePlanConfirmText', () => {
  it('на триале — нет упоминания списания', () => {
    const text = getChangePlanConfirmText(1990, true)

    expect(text).toContain('пробном периоде')
    expect(text).not.toContain('спишется')
  })

  it('не на триале — содержит сумму и период', () => {
    const text = getChangePlanConfirmText(1990, false)

    expect(text).toContain('30 дней')
    expect(text).toContain('спишется')
  })

  it('цена 0 — текст всё равно про списание (не триал)', () => {
    const text = getChangePlanConfirmText(0, false)

    expect(text).toContain('спишется')
  })
})
