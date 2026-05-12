# tables — заметка для агента

Столы и вызовы официанта (retail, toggleable модуль `dineIn`). Полная мета — `feature.manifest.ts`.

## Что модуль делает

CRUD столов, генерация QR-кодов (для прихода гостя на storefront по `/t/<code>`), визуальный layout зала, приём вызовов официанта в реальном времени. При сканировании QR гостем создаётся заказ типа `dineIn` (привязан к `table_id`).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/tables.ts` | CRUD столов + генерация QR-токенов. **Пишет также в `orders`** когда официант добавляет блюдо в стол |
| `api/table-calls.ts` | Приём/закрытие вызовов официанта |
| `composables/useTablesContext.ts` | Состояние списка столов + layout |
| `composables/useTableCallsChannel.ts` | **Глобальный канал. Один раз в layout.** Эмитит события вызовов |
| `composables/useTableCallAlertHandler.ts` | Звук+toast на новый вызов |
| `composables/useAddDishToTable.ts` | Hot path: добавить блюдо в активный заказ стола (через `DishPickerModal` из menu + ordersApi) |
| `utils/generateTableQrPdf.ts` | Чистая функция: рендер PDF со всеми QR-кодами столов для печати |

## Типовые задачи

- **Новый тип вызова:** строка в `table_call_types` (seed-only, через миграцию). UI-список тянется автоматически.
- **Кастомный QR-токен:** логика — `api/tables.regenerateToken`. Storefront дёрнет `/t/<token>` и узнает столик.
- **Layout (drag-n-drop):** `useTablesContext` хранит координаты `{x, y}` в `tables.layout`. Сохранение — патч в `api/tables.updateLayout`.

## Антипаттерны (не делай так)

- ❌ Создавать заказ для стола напрямую `ordersApi.create({type:'dineIn'})` — используй `useAddDishToTable`, он проверяет открытый заказ стола и атомарно добавляет позицию.
- ❌ Дублировать QR-логику — генерация токена и URL централизованы в `api/tables` (см. также `shared/composables/useTableUrl.ts`).
- ❌ Класть сюда логику по `dish_addons`/модификаторам — это `menu`.

## Куда расти

Reservations (бронь стола заранее) — отдельная фича `reservations`, не сюда. Связь: при подтверждении брони с `tableId` — стол помечается зарезервированным на интервал (логика в `features/reservations`).
