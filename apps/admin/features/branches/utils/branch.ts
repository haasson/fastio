import { DEFAULT_BRANCH_COLOR } from '@fastio/shared'
import type { BranchAddressData, BranchFormData } from '@fastio/shared'

/**
 * Заглушка addressData для свежей формы — пустая строка `value`. Сабмит формы
 * с такой заглушкой не пройдёт серверную валидацию (validateAddressDataConsistency
 * не упадёт на consistency, но сама строка адреса '' не пустит UiForm-валидацию).
 * Структура с реальным DaData-объектом подменяется при первом pick подсказки.
 */
const emptyAddressData: BranchAddressData = { value: '' } as BranchAddressData

/**
 * Дефолтные значения для формы создания филиала. Один источник правды для
 * BranchDrawer и OnboardingStepBranch — чтобы при добавлении нового поля
 * в Branch не пришлось править два места.
 */
export const defaultBranchFormData = (): BranchFormData => ({
  name: '',
  color: DEFAULT_BRANCH_COLOR,
  address: '',
  addressData: emptyAddressData,
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
