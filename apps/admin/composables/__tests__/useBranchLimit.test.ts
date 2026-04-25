import { describe, it, expect, vi } from 'vitest'
import { ref, computed } from 'vue'
import type { ResolvedFeatures } from '@fastio/shared'
import { useBranchLimit } from '../plan/useBranchLimit'

const mockResolved = ref<ResolvedFeatures>({
  modules: {
    dashboard: false, delivery: false, pickup: false, modifiers: false, addons: false,
    promotions: false, combos: false, kitchen: false, dineIn: false,
    reservations: false, services: false, branches: false,
    customRoles: false, customers: false, team: false,
  },
  menu: { virtualCategories: false, ingredients: false },
  resources: { max: 0 },
  site: { telegramNotifications: false },
})

const mockCanAddBranch = ref(true)

vi.mock('../plan/useResolvedFeatures', () => ({
  useResolvedFeatures: () => ({ resolved: mockResolved }),
}))

vi.mock('../plan/useGate', () => ({
  useGate: () => ({
    addBranch: computed(() => ({
      enabled: mockCanAddBranch.value,
      reason: mockCanAddBranch.value ? null : 'locked',
    })),
  }),
}))

const setup = (branchesUnlocked: boolean, canAdd: boolean) => {
  mockResolved.value.modules.branches = branchesUnlocked
  mockCanAddBranch.value = canAdd
}

describe('useBranchLimit', () => {
  describe('maxBranches', () => {
    it('модуль branches доступен → 0 (безлимит)', () => {
      setup(true, true)
      expect(useBranchLimit().maxBranches.value).toBe(0)
    })

    it('модуль branches недоступен → 1 (только главный)', () => {
      setup(false, true)
      expect(useBranchLimit().maxBranches.value).toBe(1)
    })
  })

  describe('canAddBranch', () => {
    it('addBranch enabled → true', () => {
      setup(true, true)
      expect(useBranchLimit().canAddBranch.value).toBe(true)
    })

    it('addBranch disabled → false', () => {
      setup(false, false)
      expect(useBranchLimit().canAddBranch.value).toBe(false)
    })
  })

  describe('branchLimitReached', () => {
    it('обратен canAddBranch', () => {
      setup(true, true)
      expect(useBranchLimit().branchLimitReached.value).toBe(false)
      mockCanAddBranch.value = false
      expect(useBranchLimit().branchLimitReached.value).toBe(true)
    })
  })

  describe('branchLimitLabel', () => {
    it('1 → "филиал"', () => {
      setup(false, true) // unlocked=false → max=1
      expect(useBranchLimit().branchLimitLabel.value).toBe('филиал')
    })

    it('0 → "филиалов" (безлимит)', () => {
      setup(true, true) // unlocked=true → max=0
      expect(useBranchLimit().branchLimitLabel.value).toBe('филиалов')
    })
  })
})
