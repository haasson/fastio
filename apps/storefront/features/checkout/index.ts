// Public barrel of the checkout module.
// Чекаут (shared aggregator): final-step оформления заказа — адрес/филиал/самовывоз/промо/контакты + submit.
// Работает с гибридной корзиной (блюда + услуги).

export { useCheckoutStore, type CheckoutDeliveryZone } from './stores/checkout'
