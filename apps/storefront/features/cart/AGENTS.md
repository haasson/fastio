# cart — заметка для агента

Гибридная корзина витрины. **Cross-vertical (shared aggregator)** — хранит и блюда, и услуги в одной куче.

## Что модуль делает

`useCartStore` хранит массив `CartItem[]` где элементы могут быть двух типов:
- `DishCartItem` (kind='dish') — блюдо с модификаторами/аддонами/удалёнными ингредиентами (retail)
- `ServiceCartItem` (kind='service') — услуга с datetime/resource (services)

Type-guards: `isDishItem` / `isServiceItem`. Cart восстанавливается из localStorage через `plugins/cart-restore.client.ts` при загрузке страницы.

`useCartEdit` — открытие модалки редактирования item в корзине (вызывает DishModal/ServiceModalBody в зависимости от kind).

`useCartReconciler` — фоновая проверка: что в корзине ещё валидно (блюдо не удалили, услуга не закрыли, цены те же). Удаляет битые позиции с toast'ом «X отменено».

## Карта модуля

| Файл | Что внутри |
|---|---|
| `stores/cart.ts` | `useCartStore`, типы `DishCartItem`/`ServiceCartItem`/`CartItem`, guards `isDishItem`/`isServiceItem` |
| `composables/useCartEdit.ts` | Open-edit модалки для item корзины (cart-режим, не add-to-cart) |
| `composables/useCartReconciler.ts` | Reconcile корзины с актуальным меню+услугами при смене филиала / refresh |
| `components/CartLineItem.vue` | Одна строка в корзине (универсальная для блюд и услуг через `v-if isDishItem/isServiceItem`) |
| `components/CartBranchStatus.vue` | Плашка «Доступность блюд в выбранном филиале» (X блюд недоступно, перевыбрать филиал?) |
| `__tests__/cart.test.ts` | Юнит-тесты на store: add/remove/update/total |

## Типовые задачи

- **Новый тип item (например, `BookingCartItem` для брони стола?):** добавь `kind: 'booking'` в discriminated union `CartItem`, type-guard, ветку в `CartLineItem.vue` и `useCartEdit`.
- **Новое поле в DishCartItem:** правь тип в `stores/cart.ts` + миграцию `useCartReconciler` (важно: не сломать сохранённые в localStorage старые items).
- **Изменить логику пересчёта:** правь `useCartReconciler.ts`. Тесты на cart-логику в `__tests__/cart.test.ts`.

## Антипаттерны (не делай так)

- ❌ Импорт `~/features/cart/stores/cart` снаружи модуля — через `~/features/cart` (barrel).
- ❌ Положить cart в retail или services — это shared aggregator, по дизайну видит обе вертикали. См. ESLint config `AGGREGATOR_FILES`.
- ❌ Хранить cart в Pinia без localStorage backup — пользователь обновит страницу и корзина пропадёт. Восстановление через `plugins/cart-restore.client.ts`.
- ❌ Считать total на каждом render компонента — `useCartStore` уже даёт computed `subtotal`/`total` (с учётом промо).
- ❌ Менять `kind: string` на enum — discriminated union TS работает лучше с string-literals.

## Куда расти

- **Реактивные цены в корзине** (WISHLIST): уже описано — `useCartReconciler` подхватывает изменения цен из menu store.
- **Программа лояльности** (WISHLIST): добавится `bonusUsed` в state корзины + поле формы на чекауте.
- **Стол-режим без cart**: на `pages/table/[id]/` сейчас cart не используется (заказ напрямую POST). Если захотим объединить — миграция данных.
