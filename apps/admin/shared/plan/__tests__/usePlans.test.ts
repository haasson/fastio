import { describe, it, expect, vi, beforeEach } from 'vitest'
import { usePlans } from '../usePlans'
import type { Plan } from '@fastio/shared'

const mockPlansList = vi.fn<() => Promise<Plan[]>>()

vi.mock('~/shared/data/useDatabase', () => ({
  useDatabase: () => ({
    plans: { list: mockPlansList },
  }),
}))

const DEFAULT_FEATURES = {}

const TEST_PLANS: Plan[] = [
  { id: '1', key: 'retail-showcase', businessType: 'retail', name: 'Витрина', description: '', price: 0, isActive: true, sortOrder: 0, features: DEFAULT_FEATURES, badge: null, isFeatured: false },
  { id: '2', key: 'retail-start', businessType: 'retail', name: 'Старт', description: '', price: 490, isActive: true, sortOrder: 1, features: DEFAULT_FEATURES, badge: null, isFeatured: false },
  { id: '3', key: 'retail-pro', businessType: 'retail', name: 'Про', description: '', price: 2490, isActive: true, sortOrder: 2, features: DEFAULT_FEATURES, badge: null, isFeatured: false },
  { id: '4', key: 'services-start', businessType: 'services', name: 'Старт', description: '', price: 690, isActive: true, sortOrder: 1, features: DEFAULT_FEATURES, badge: null, isFeatured: false },
  { id: '5', key: 'services-pro', businessType: 'services', name: 'Про', description: '', price: 3490, isActive: true, sortOrder: 2, features: DEFAULT_FEATURES, badge: null, isFeatured: false },
]

describe('usePlans', () => {
  beforeEach(() => {
    const { invalidate, plans } = usePlans()

    invalidate()
    plans.value = []
    mockPlansList.mockClear()
    mockPlansList.mockResolvedValue(TEST_PLANS)
  })

  describe('getPlanSortOrder — до загрузки', () => {
    it('showcase → 0 (безопасный дефолт)', () => {
      const { getPlanSortOrder } = usePlans()

      expect(getPlanSortOrder('showcase')).toBe(0)
    })

    it('pro → Infinity (всё залочено до загрузки)', () => {
      const { getPlanSortOrder } = usePlans()

      expect(getPlanSortOrder('pro')).toBe(Infinity)
    })
  })

  describe('getPlanSortOrder — после загрузки', () => {
    it('уровни возвращают правильный порядок', async () => {
      const { load, getPlanSortOrder } = usePlans()

      await load()
      expect(getPlanSortOrder('showcase')).toBe(0)
      expect(getPlanSortOrder('start')).toBe(1)
      expect(getPlanSortOrder('pro')).toBe(2)
    })

    it('полные ключи с префиксом тоже работают', async () => {
      const { load, getPlanSortOrder } = usePlans()

      await load()
      expect(getPlanSortOrder('retail-showcase')).toBe(0)
      expect(getPlanSortOrder('retail-start')).toBe(1)
      expect(getPlanSortOrder('services-pro')).toBe(2)
    })

    it('неизвестный ключ → 0', async () => {
      const { load, getPlanSortOrder } = usePlans()

      await load()
      expect(getPlanSortOrder('enterprise')).toBe(0)
    })
  })

  describe('getPlanLabel', () => {
    it('до загрузки → возвращает ключ как есть', () => {
      const { getPlanLabel } = usePlans()

      expect(getPlanLabel('retail-pro')).toBe('retail-pro')
    })

    it('после загрузки → полный ключ', async () => {
      const { load, getPlanLabel } = usePlans()

      await load()
      expect(getPlanLabel('retail-showcase')).toBe('Витрина')
      expect(getPlanLabel('retail-start')).toBe('Старт')
      expect(getPlanLabel('retail-pro')).toBe('Про')
    })

    it('после загрузки → уровень (для module_configs.required_plan_key)', async () => {
      const { load, getPlanLabel } = usePlans()

      await load()
      expect(getPlanLabel('showcase')).toBe('Витрина')
      expect(getPlanLabel('start')).toBe('Старт')
      expect(getPlanLabel('pro')).toBe('Про')
    })

    it('неизвестный ключ → возвращает ключ', async () => {
      const { load, getPlanLabel } = usePlans()

      await load()
      expect(getPlanLabel('unknown')).toBe('unknown')
    })
  })

  describe('load', () => {
    it('повторный вызов не дёргает API дважды', async () => {
      const { load } = usePlans()

      await load()
      await load()
      expect(mockPlansList).toHaveBeenCalledTimes(1)
    })

    it('invalidate сбрасывает кэш', async () => {
      const { load, invalidate } = usePlans()

      await load()
      invalidate()
      await load()
      expect(mockPlansList).toHaveBeenCalledTimes(2)
    })
  })
})
