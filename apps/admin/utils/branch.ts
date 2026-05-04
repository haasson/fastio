import { DEFAULT_BRANCH_COLOR } from '@fastio/shared'
import type { BranchFormData } from '@fastio/shared'

/**
 * Дефолтные значения для формы создания филиала. Один источник правды для
 * BranchDrawer и OnboardingStepBranch — чтобы при добавлении нового поля
 * в Branch не пришлось править два места.
 */
export const defaultBranchFormData = (): BranchFormData => ({
  name: '',
  color: DEFAULT_BRANCH_COLOR,
  address: '',
  phone: null,
  isActive: true,
  workingHoursSchedule: null,
  deliveryMinOrder: null,
  deliveryFee: null,
  notifications: null,
  latitude: null,
  longitude: null,
  orderNumberPrefix: null,
})
