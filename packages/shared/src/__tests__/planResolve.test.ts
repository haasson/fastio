import { describe, it, expect } from 'vitest'
import type { Plan } from '../types/billing'
import { resolveFeaturesForPlan } from '../utils/planResolve'

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

describe('resolveFeaturesForPlan', () => {
  describe('базовые сценарии', () => {
    it('пустой массив планов → все фичи false/0', () => {
      const result = resolveFeaturesForPlan([], 'retail-start', 'retail')

      expect(result.modules.delivery).toBe(false)
      expect(result.modules.promotions).toBe(false)
      expect(result.menu.virtualCategories).toBe(false)
      expect(result.site.telegramNotifications).toBe(false)
      expect(result.resources.max).toBe(0)
    })

    it('план с delivery=true → delivery=true в результате', () => {
      const plans = [makePlan({ key: 'retail-start', features: { modules: { delivery: true } } })]
      const result = resolveFeaturesForPlan(plans, 'retail-start', 'retail')

      expect(result.modules.delivery).toBe(true)
    })

    it('план с delivery=false → delivery=false', () => {
      const plans = [makePlan({ key: 'retail-start', features: { modules: { delivery: false } } })]
      const result = resolveFeaturesForPlan(plans, 'retail-start', 'retail')

      expect(result.modules.delivery).toBe(false)
    })
  })

  describe('аккумуляция по уровням', () => {
    const showcasePlan = makePlan({
      key: 'retail-showcase',
      features: { modules: { delivery: false }, site: { telegramNotifications: false } },
    })
    const startPlan = makePlan({
      key: 'retail-start',
      features: { modules: { delivery: true }, site: { telegramNotifications: false } },
    })
    const proPlan = makePlan({
      key: 'retail-pro',
      features: {
        modules: { promotions: true },
        site: { telegramNotifications: true },
        menu: { virtualCategories: true },
      },
    })
    const allPlans = [showcasePlan, startPlan, proPlan]

    it('start-тариф включает фичи showcase + start', () => {
      const result = resolveFeaturesForPlan(allPlans, 'retail-start', 'retail')

      expect(result.modules.delivery).toBe(true)
      expect(result.modules.promotions).toBe(false)
    })

    it('pro-тариф включает фичи showcase + start + pro', () => {
      const result = resolveFeaturesForPlan(allPlans, 'retail-pro', 'retail')

      expect(result.modules.delivery).toBe(true)
      expect(result.modules.promotions).toBe(true)
      expect(result.site.telegramNotifications).toBe(true)
      expect(result.menu.virtualCategories).toBe(true)
    })

    it('showcase-тариф не включает фичи из start/pro', () => {
      const result = resolveFeaturesForPlan(allPlans, 'retail-showcase', 'retail')

      expect(result.modules.delivery).toBe(false)
      expect(result.modules.promotions).toBe(false)
    })
  })

  describe('изоляция по businessType', () => {
    it('services-план не влияет на retail-результат', () => {
      const plans = [
        makePlan({ key: 'retail-start', businessType: 'retail', features: { modules: { delivery: true } } }),
        makePlan({ key: 'services-start', businessType: 'services', features: { modules: { delivery: true } } }),
      ]
      const result = resolveFeaturesForPlan(plans, 'retail-start', 'retail')

      // Только retail-start должен аккумулироваться
      expect(result.modules.delivery).toBe(true)
    })

    it('retail-план не влияет на services-результат', () => {
      const plans = [
        makePlan({ key: 'retail-pro', businessType: 'retail', features: { modules: { promotions: true } } }),
        makePlan({ key: 'services-start', businessType: 'services', features: { resources: { max: 5 } } }),
      ]
      const result = resolveFeaturesForPlan(plans, 'services-start', 'services')

      expect(result.modules.promotions).toBe(false)
      expect(result.resources.max).toBe(5)
    })
  })

  describe('resources.max', () => {
    it('resources.max=0 (неограниченно) устанавливается', () => {
      const plans = [makePlan({ key: 'services-pro', businessType: 'services', features: { resources: { max: 0 } } })]
      const result = resolveFeaturesForPlan(plans, 'services-pro', 'services')

      expect(result.resources.max).toBe(0)
    })

    it('resources.max=5 устанавливается', () => {
      const plans = [makePlan({ key: 'services-start', businessType: 'services', features: { resources: { max: 5 } } })]
      const result = resolveFeaturesForPlan(plans, 'services-start', 'services')

      expect(result.resources.max).toBe(5)
    })
  })
})
