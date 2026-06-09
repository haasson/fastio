# kitchen — заметка для агента

Кухонная очередь (retail, toggleable модуль `kitchen`). Полная мета — `feature.manifest.ts`.

## Что модуль делает

KDS-режим (Kitchen Display System): блюда из активных заказов попадают в `kitchen_queue` (через триггер БД), повар отмечает «в работе» / «готово». Сборщик видит overlay по чек-листу.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/kitchen-queue.ts` | CRUD/transitions для строк `kitchen_queue` |
| `composables/useKitchenQueueChannel.ts` | **Глобальный канал. Один раз в layout.** Эмитит события очереди |
| `composables/useKitchenProgress.ts` | Время с момента появления блюда в очереди (для алертов о просрочках) |
| `composables/useKitchenStatusBlock.ts` | UI-state блока статуса в карточке блюда |

## Типовые задачи

- **Новый статус приготовления:** добавь enum в БД-миграцию + расширь `api/kitchen-queue.transition()` + UI кнопку. **НЕ** добавляй статус в `order_statuses` — это разные домены.
- **Права кухни:** доступ к очереди — `kitchen.view` (route-гейт). Действия готовки (взять/готово/вернуть/замена) на `/kitchen/queue` гейтятся отдельным `kitchen.cook` → `gate.cookKitchen` (проп `canCook` в `KitchenQueueItem`/`KitchenWorkCard`/`KitchenSubstitutionCard` + гард в хендлерах). Без `kitchen.cook` очередь — read-only просмотр нагрузки. Сборка на `/assembly` — под `kitchen.view`, но «Собрано» логирует событие `kitchen_served` в таймлайн заказа (атрибуция «кто собрал»).
- **Алерт о просрочке:** логика в `useKitchenProgress` (порог по времени). Звук/toast — `useKitchenStatusBlock`.
- **Привязка к станциям/категориям:** маршрутизация блюд по станциям делается на БД-триггере (см. миграции `kitchen_queue`). Из фронта только конфиг (`/kitchen/settings`).

## Антипаттерны (не делай так)

- ❌ Дёргать `orders` из `api/kitchen-queue` — `kitchen_queue` это денормализованная очередь, заказы в неё попадают триггером. Если нужна инфа о заказе — джойни через ID, не вызывай заново.
- ❌ Создавать второй realtime-канал — он уже глобальный.
- ❌ Класть сюда логику dish/modifier — это `features/menu`.

## Куда расти

Если потребуется bumper/printer integration — отдельная фича `kitchen-printers`, не разрастаем эту.
