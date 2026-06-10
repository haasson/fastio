# tables — заметка для агента

Столы и вызовы официанта (retail, toggleable модуль `dineIn`). Полная мета — `feature.manifest.ts`.

## Модель: стол = один редактируемый чек

Открытая посадка за столом = ОДНА редактируемая строка `orders` («чек», `check_status='open'`). Позиции (`order_items`) дозаписываются в неё и официантом, и QR-гостем; расчёт — один раз в конце.

- `orders.check_status` = `open | settled | cancelled` (NULL для не-dine_in). `settled_at` / `settled_by` фиксируют расчёт. `payment_type` (cash|card|online) переиспользован как способ оплаты при расчёте — отдельного `paid_method` нет.
- Инвариант: partial unique index `orders_one_open_check_per_table` → ≤1 открытый чек на стол. `tables.is_open` ⟺ открытый чек существует (1:1).
- НЕ создавать заказ на стол per-dish и НЕ держать per-cart заказ от QR — модель «одна строка per dish» мертва.

## RPC (миграции 325-327)

- `open_table_check(p_table_id)` — открывает стол + создаёт пустой open-чек, линкует seated-бронь.
- `add_items_to_check(p_table_id, p_items_json, p_status)` — дозапись позиций. `confirmed` = официант → сразу на кухню; `pending` = QR-гость → ждёт подтверждения персонала. Пересчитывает subtotal/total.
- `settle_table_check(p_check_id, p_discount_amount, p_payment_type)` — clamp скидки + оплата + `settled_by/at`, закрывает стол, завершает seated-бронь. Пустой чек → `cancelled`.
- `apply_table_discount` УДАЛЁН — скидка теперь только параметр `settle_table_check`.

## Кухня и расчёт

- Кухня едет на СУЩЕСТВУЮЩИХ триггерах `order_items` (не трогать): `confirmed` от официанта → на кухню; `pending` от QR → на кухню только после подтверждения персоналом; delete позиции → кухонная отмена.
- `settle` НЕ трогает кухню для непустого чека — повара доготавливают после оплаты. Это намеренно.
- Telegram «новый заказ» подавляется для dine_in (per-cart заказа больше нет; персонал смотрит realtime-доску столов).
- QR-гостю dine_in промокоды НЕ выдаются — скидки только на расчёте персоналом.
- `delete_order_item_atomic` НЕ удаляет заказ при удалении последней позиции из ОТКРЫТОГО dine_in чека — пустой чек остаётся жив.

## История

История = список чеков `check_status='settled'` (одна строка = одна оплаченная посадка). Drawer показывает позиции + расчёт (оплата/кто/когда) + бронь + таймлайн. Право `tables.history` / gate `viewTableHistory`.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/tables.ts` | CRUD столов + QR-токены. `openCheck`/`addItems`/`settleCheck` → RPC выше. Читает открытый чек по `table_id`+`check_status='open'` |
| `api/table-calls.ts` | Приём/закрытие вызовов официанта |
| `composables/useTablesContext.ts` | Состояние списка столов + layout |
| `composables/useTablesChannel.ts` | **Глобальный канал. Один раз в `useRealtimeChannels`.** Realtime по `tables` → `tableEvents` |
| `composables/useTableCallsChannel.ts` | **Глобальный канал. Один раз в layout.** Эмитит события вызовов |
| `composables/useTableCallAlertHandler.ts` | Звук+toast на новый вызов |
| `composables/useAddDishToTable.ts` | Hot path: дозапись блюда в open-чек стола (через `DishPickerModal` из menu → `api.tables.addItems`, status `confirmed`) |
| `components/TableCheckoutModal.vue` | Расчёт: скидка + способ оплаты → `settleCheck` |
| `components/TableSessionDrawer.vue` | Панель стола: позиции, кухня, действия, расчёт |
| `utils/generateTableQrPdf.ts` | Чистая функция: PDF со всеми QR-кодами столов |

## Типовые задачи

- **Новый тип вызова:** строка в `table_call_types` (seed-only, через миграцию). UI-список тянется автоматически.
- **Кастомный QR-токен:** `api/tables.regenerateToken`. Storefront дёрнет `/t/<token>`.
- **Layout (drag-n-drop):** `useTablesContext` хранит `{x, y}` в `tables.layout`. Сохранение — `api/tables.updateLayout`.

## Антипаттерны (не делай так)

- ❌ Создавать заказ на стол напрямую `ordersApi.create({type:'dineIn'})` — открытие чека только через `open_table_check`, дозапись только через `add_items_to_check` (`useAddDishToTable`/`api.tables.addItems`).
- ❌ Применять скидку отдельным вызовом — только параметр `settle_table_check`.
- ❌ Трогать кухню при расчёте — кухня едет на триггерах `order_items`, не вмешивайся.
- ❌ Слать Telegram «новый заказ» на dine_in.
- ❌ Дублировать QR-логику — генерация токена/URL в `api/tables` (+ `shared/composables/useTableUrl.ts`).
- ❌ Класть сюда логику `dish_addons`/модификаторов — это `menu`.

## Куда расти

Reservations (бронь стола заранее) — фича `reservations`, не сюда. Связь: `open_table_check` линкует seated-бронь, `settle_table_check` её завершает.
