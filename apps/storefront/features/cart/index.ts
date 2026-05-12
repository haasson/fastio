// Public barrel of the cart module.
// Гибридная корзина (shared aggregator): хранит и DishCartItem (retail), и ServiceCartItem (services).
// Используется обеими вертикалями + checkout/order flow.

export {
  useCartStore,
  type CartItem,
  type DishCartItem,
  type ServiceCartItem,
  isDishItem,
  isServiceItem,
} from './stores/cart'

export { useCartEdit } from './composables/useCartEdit'
export { useCartReconciler } from './composables/useCartReconciler'

// Branch-compat utils — логически часть cart (зависят от DishCartItem/ServiceCartItem типов).
export {
  computeBranchCompat,
  getMissingBranchDishNames,
  type BranchCompat,
  type BranchStatus,
  type BranchInfo,
} from './utils/branchCompat'

export {
  calcAppointmentBranchReset,
  type AppointmentBranchResetResult,
  type ServiceCompat,
  type ResourceCompat,
} from './utils/appointmentBranchCompat'
