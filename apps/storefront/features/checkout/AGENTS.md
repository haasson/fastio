# checkout — заметка для агента

Финальный шаг оформления заказа. **Cross-vertical (shared aggregator)** — оформляет и retail-заказ (блюда), и services-запись (услуги) в одной форме.

## Что модуль делает

`useCheckoutStore` хранит state формы чекаута:
- delivery type (`delivery` / `pickup` / `dine_in`)
- адрес доставки или выбранный филиал самовывоза
- payment type (`cash` / `card_on_delivery` / `online`)
- контакты (имя/телефон/email)
- comment, промокод

Финальный submit формирует payload:
- Если в корзине есть блюда (`DishCartItem`) → POST `/api/orders`
- Если есть услуги (`ServiceCartItem`) → POST `/api/appointments/request`
- Если оба — два запроса (одна корзина = один сабмит, но два запроса наверх).

`useCheckoutStore` работает в связке с `useCartStore` (источник позиций) + `useMenuStore` (для финальной валидации цен/доступности).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `stores/checkout.ts` | `useCheckoutStore` — всё state формы + computed total + submit; `CheckoutDeliveryZone` тип |
| `components/CheckoutAddressSection.vue` | Блок «Адрес доставки» (выбор сохранённого / ручной ввод) |
| `components/AddressManualInput.vue` | Полная форма ручного адреса (улица/дом/квартира/комментарий + dadata-suggestions) |
| `components/CheckoutPickupBranch.vue` | Селектор филиала для самовывоза (с проверкой доступности блюд в филиале) |
| `components/CheckoutPromoSection.vue` | Блок «Промокод» (применить/убрать) |
| `components/CheckoutSidebar.vue` | Правая колонка: список позиций + total + submit-кнопка |
| `components/CheckoutSummary.vue` | Итог заказа (подытог, скидка, доставка, total) |

## Типовые задачи

- **Новое поле в форме (например, «гости в зале»):** добавь поле в `useCheckoutStore.form` → UI в соответствующем `Checkout*Section` → серверный endpoint.
- **Новый тип доставки (например, `courier_yandex`):** enum в БД + миграция + `OrderDeliveryType` в `@fastio/shared` + ветка в `useCheckoutStore.submit`.
- **Новый способ оплаты:** аналогично — enum + UI в `CheckoutSidebar`/`Summary`.

## Антипаттерны (не делай так)

- ❌ Прямой `supabase.from('orders').insert()` — RLS не пропустит без service-role. Всё через `/api/orders`.
- ❌ Импорт `~/features/checkout/stores/checkout` снаружи модуля — через `~/features/checkout`.
- ❌ Считать total на клиенте и доверять ему на бэке — сервер всегда пересчитывает (промо, доставку, бонусы).
- ❌ Хранить промокод в localStorage — это сессионное состояние, не персистентное.

## Куда расти

- **Онлайн-оплата** (WISHLIST): Stripe / ЮKassa — добавится `payment_type='online'` обработка + redirect flow.
- **Программа лояльности** (WISHLIST): поле «списать бонусы» + взаимодействие с `customer_bonuses` таблицей.
- **Тарифы доставки по времени суток** (WISHLIST): расчёт зоны учтёт `now` и применит наценку.
- **Yandex Доставка** (WISHLIST): новый `payment_type='courier_yandex'` + integration на сервере.
