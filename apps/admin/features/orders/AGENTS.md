# orders — заметка для агента

Заказы (retail). Полная мета — `feature.manifest.ts`.

## Что модуль делает

Приём заказов, переходы статусов, события (audit trail), доставка, кастомизация номера заказа. Самая «центральная» фича retail — слушают её realtime и `menu`, `kitchen`, `tables`, `promotions`.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/orders.ts` | CRUD заказа + позиции + статусы. SELECT с подгрузкой items |
| `api/order-events.ts` | Журнал событий заказа (audit) — append-only |
| `api/order-notes.ts` | Комментарии команды к заказу |
| `api/order-statuses.ts` | CRUD кастомных статусов (`order_statuses`) |
| `api/delivery-zones.ts` | Зоны доставки и тарифы |
| `composables/useOrdersChannel.ts` | **Глобальный realtime-канал. Вызывать ОДИН раз в layout.** Эмитит `orderEvents` |
| `composables/useOrders.ts` | Список + локальные обработчики realtime |
| `composables/useOrderCard.ts` | Состояние карточки одного заказа |
| `composables/useOrderStatus.ts` | Логика смены статуса (включая `orders.cancel` permission) |
| `composables/useOrderStatuses.ts` | Realtime-список кастомных статусов |
| `composables/useOrderPromo.ts` | Применение промокодов / скидок (связь с `promotions`) |
| `composables/useOrderDishPicker.ts` | Glue для `DishPickerModal` из `menu` |
| `composables/useOrderTable.ts` | Колонки/фильтры таблицы заказов |
| `composables/useOrderEvents.ts` | Realtime-фид событий заказа (audit-лента в drawer'е) |
| `composables/useOrderEventLogger.ts` | Запись audit-события (используется внутри API/composables) |
| `composables/useOrderNotes.ts` | Состояние заметок к заказу |
| `composables/useOrderCounts.ts` | Счётчики по статусам (для бейджей в навигации) |
| `composables/useOrderCustomerHistory.ts` | История заказов конкретного гостя (в drawer'е) |
| `composables/useStatusColor.ts` | Чистая утилка цвета статуса (для UI) |
| `composables/useNewOrderCounter.ts` | Бейдж непросмотренных заказов |
| `composables/useOrderAlertHandler.ts` | Звук + toast на новый заказ |
| `composables/delivery/*` | Доставка: подбор зоны, расчёт стоимости |
| `stores/order-statuses.ts` / `stores/deliveryZone.ts` | Глобальные сторы кастомных статусов и зон |
| `utils/format-order.ts` | Чистая функция форматирования номера заказа (по `OrderNumberConfig`) |

## Типовые задачи

- **Новый переход статуса:** добавь в `ordersApi.updateStatus` или сделай отдельный метод. Логируй в `order_events` через `useOrderEventLogger` — это требование аудита.
- **Новое поле заказа:** миграция + `Order` тип в `packages/shared/src/types/order.ts` + `mapOrder` в `@fastio/shared` + `SELECT_FIELDS` в `api/orders.ts`.
- **Связать с акцией:** через `useOrderPromo`. Логика самой акции — `features/promotions`, эта фича только применяет результат.
- **Кастомизация номера:** конфиг хранится в `tenants.order_number_config`. Форматтер — чистая функция `format-order.ts`, юзай его и в storefront тоже (вынеси в `@fastio/shared` если потребуется).

## Антипаттерны (не делай так)

- ❌ Создавать второй канал на `orders` — он один (`useOrdersChannel` + `orderEvents`). Подписывайся на события, не на таблицу.
- ❌ Писать в `order_events` напрямую — только через `useOrderEventLogger` (он добавляет actor, timestamp, нормализует payload).
- ❌ Изменять `orders.status` минуя `useOrderStatus` — там проверка permission `orders.status`/`orders.cancel`.
- ❌ Считать доставку в компонентах — `composables/delivery/useOrderDelivery` это уже умеет.
- ❌ Реализовывать «скидки» на лету — это `features/promotions`. Эта фича консьюмер.

## Куда расти

Аналитика заказов (revenue, top-dishes) — НЕ сюда, отдельная фича `analytics` (когда появится). Сейчас базовый dashboard работает в `apps/admin/composables/retail/useDashboardStats.ts` (vertical-shared).
