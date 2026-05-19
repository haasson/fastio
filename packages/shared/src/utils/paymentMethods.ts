import type { PaymentMethod } from '../types/tenant'

/**
 * Дефолтные методы оплаты, применяемые когда `tenants.payment_methods` пуст/NULL.
 *
 * Почему именно эти два:
 * - `'cash'` — наличные при получении, доступны всегда без интеграций.
 * - `'card'` — карта при получении (терминал/курьер), тоже без интеграций.
 *
 * Почему НЕТ `'online'`:
 * - Платёжный провайдер (YooKassa) ещё не интегрирован (см. WISHLIST.md).
 * - Если включить online без провайдера — заказ создастся, но деньги не спишутся,
 *   а курьер уедет с нулём. Историческая бага PREPROD: legacy-тенанты с
 *   `payment_methods=['cash','card','online']` приводили к незаплаченным заказам.
 * - Серверная валидация (`VALID_PAYMENT_TYPES` в `order-validation.ts`) рубит online
 *   на корню — а этот fallback используется до серверной валидации.
 */
export const DEFAULT_PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'card'] as const
