# table-mode — заметка для агента

QR-меню в заведении: гость сканит QR на столе, видит свой чек (позиции, статусы из кухни) и при желании догоняет заказ.

## Что модуль делает

Хранит `tableId`/`tableName` + список `checkItems` (позиции, заказанные за этим столом) в Pinia-сторе. Realtime-композабл слушает события в таблицах `order_items` и `kitchen_queue`, дёргает `onChange` при изменении — страница перезапрашивает чек. Параллельно poll каждые 30s как fallback.

Активные позиции: status ∈ {pending, confirmed}. Статусы из кухни (`kitchenStatus`): queued → in_progress → done → served.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `stores/table.ts` | `useTableStore` — state стола (id, name, чек, computed totals) + `setTable/setCheckItems/clear` |
| `composables/useTableRealtime.ts` | Подписка на realtime + 30s-poll. Принимает `tenantId` + callback `onChange`. |
| `components/TableCheckItem.vue` | Одна строка чека (название блюда + модификаторы + addons + статус) |

## Типовые задачи

- **Новый статус кухни:** enum в БД (миграция) + расширь `CheckItem.kitchenStatus` в `stores/table.ts` + UI цвета в компоненте.
- **Добавить кнопку «оплатить»:** на стороне сервера endpoint `/api/table/[id]/checkout` → клиент дёргает $fetch с `tableId`.
- **Новая колонка отображения:** правь `TableCheckItem.vue`.

## Антипаттерны (не делай так)

- ❌ Создавать второй realtime-канал на `order_items` или `kitchen_queue` — `useTableRealtime` уже даёт callback.
- ❌ Кешировать `checkItems` в localStorage — это live-state стола, кеш нерелевантен (другой гость на следующий день получит чужой чек).
- ❌ Импорт `~/features/table-mode/stores/table` снаружи модуля — через `~/features/table-mode` (barrel).

## Куда расти

- Кнопка «вызвать официанта» (есть в admin tables, миграция table_calls). Сделать клиентскую часть.
- Split-bill: разделить чек между гостями.
