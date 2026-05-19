import { describe, it, expect } from 'vitest'
import {
  extractPlanTier,
  getPlanTierOrder,
  PLAN_LEVEL_ORDER,
  PLAN_TIER_LABELS,
} from '../utils/planLevel'

describe('extractPlanTier', () => {
  it('retail-showcase → "showcase"', () => {
    expect(extractPlanTier('retail-showcase')).toBe('showcase')
  })

  it('retail-start → "start"', () => {
    expect(extractPlanTier('retail-start')).toBe('start')
  })

  it('retail-pro → "pro"', () => {
    expect(extractPlanTier('retail-pro')).toBe('pro')
  })

  it('services-showcase → "showcase"', () => {
    expect(extractPlanTier('services-showcase')).toBe('showcase')
  })

  it('services-start → "start"', () => {
    expect(extractPlanTier('services-start')).toBe('start')
  })

  it('services-pro → "pro"', () => {
    expect(extractPlanTier('services-pro')).toBe('pro')
  })

  it('строка без префикса — возвращается как есть', () => {
    expect(extractPlanTier('pro')).toBe('pro')
    expect(extractPlanTier('start')).toBe('start')
  })
})

describe('getPlanTierOrder', () => {
  it('showcase → 0', () => {
    expect(getPlanTierOrder('retail-showcase')).toBe(0)
  })

  it('start → 1', () => {
    expect(getPlanTierOrder('retail-start')).toBe(1)
  })

  it('pro → 2', () => {
    expect(getPlanTierOrder('retail-pro')).toBe(2)
  })

  it('services-showcase → 0', () => {
    expect(getPlanTierOrder('services-showcase')).toBe(0)
  })

  it('services-pro → 2', () => {
    expect(getPlanTierOrder('services-pro')).toBe(2)
  })

  it('неизвестный ключ → 0 (дефолт)', () => {
    expect(getPlanTierOrder('unknown-plan')).toBe(0)
  })

  it('порядок showcase < start < pro', () => {
    const showcase = getPlanTierOrder('retail-showcase')
    const start = getPlanTierOrder('retail-start')
    const pro = getPlanTierOrder('retail-pro')

    expect(showcase).toBeLessThan(start)
    expect(start).toBeLessThan(pro)
  })
})

describe('PLAN_LEVEL_ORDER', () => {
  it('содержит 3 уровня', () => {
    expect(Object.keys(PLAN_LEVEL_ORDER)).toHaveLength(3)
  })

  it('showcase=0, start=1, pro=2', () => {
    expect(PLAN_LEVEL_ORDER.showcase).toBe(0)
    expect(PLAN_LEVEL_ORDER.start).toBe(1)
    expect(PLAN_LEVEL_ORDER.pro).toBe(2)
  })
})

describe('PLAN_TIER_LABELS', () => {
  it('содержит 3 уровня с русскими названиями', () => {
    expect(Object.keys(PLAN_TIER_LABELS)).toHaveLength(3)
    expect(PLAN_TIER_LABELS.showcase).toBe('Витрина')
    expect(PLAN_TIER_LABELS.start).toBe('Старт')
    expect(PLAN_TIER_LABELS.pro).toBe('Про')
  })
})
