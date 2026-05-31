# Phase 06: Kitchen Queue Lifecycle Coherence — PLAN

**Дата:** 2026-05-29
**Тип:** целевая хирургия (не редизайн)
**Контекст для исполнителя:** этот документ — единственный источник правды. Читай целиком перед правками. Многое УЖЕ работает — не переписывай, делай точечно.

---

## 1. Проблема (корень)

Блюда исчезают с кухонного экрана (KDS) при отмене/правке заказа. Доказано репродукцией в БД + событийным логом прод-демо-тенанта.

**Корень:** строки `kitchen_queue` намертво привязаны к заказу/позиции через `ON DELETE CASCADE` (migration `071`):
```
order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE
order_id      uuid NOT NULL REFERENCES orders(id)      ON DELETE CASCADE
```
Любое физическое удаление `order_items`/`orders` молча сносит строку кухни → realtime `DELETE` → фронт (`queue.vue` onDelete) убирает карточку без следа.

**Пути, которые это запускают:**
1. **`update_order_with_items`** (migration `296`) — на ЛЮБОМ сохранении заказа через drawer делает `DELETE FROM order_items` + reinsert ВСЕХ позиций. Даже правка адреса/телефона или отмена через выбор статуса в форме → каскад сносит всю кухню заказа. Для ритейла обратно НЕ наполняется (guard `kitchen_queued_at`, migration `141`). **Это основной наблюдаемый баг** (подтверждено: в event-логе `field_updated` телефона + исчезли строки кухни, хотя `order_items` переинсёрчены).
2. **`delete_order_item_atomic`** (migration `295`) — удаляет позицию (+заказ, если опустел) → каскад.
3. `rejectItem` (`orders.ts`) — `DELETE order_items WHERE status='pending'`. Но pending dine-in позиции кухонных строк НЕ имеют (insert-триггер пропускает `pending`), так что тут орфанов нет — но путь учесть.

Фронт KDS построен под **soft-cancel** (строка остаётся `status='cancelled'`, показывается перечёркнутой; migrations `077` cancelled-статус, `140` `dismissed_at`). Но половина путей делает **hard-DELETE** мимо этой логики. Никакая фронт-правка не переживёт удаление строки. Мы чинили soft-ветку, ломалась hard-ветка.

---

## 2. Доменная модель (ЗАФИКСИРОВАНО — это данность, не обсуждается)

`kitchen_queue` = **тупой независимый контейнер клонов-блюд**. Каждый клон уже хранит денормализованную копию блюда (`dish_name`, `modifiers`, `addons`, `removed_ingredients`, `category_name`), `delivery_type`, ярлык контекста (`order_id`), `skip_kitchen`, свой статус. Для готовки и отрисовки живой `order_items` ему НЕ нужен.

Два РАЗНЫХ потребителя одного контейнера:

### Зал (`delivery_type = 'dine_in'`)
- **Понятия «заказ» НЕТ.** Есть стол, на него заказывают отдельные блюда. `order_id` в БД для dine_in = сессия стола, но концептуально это «блюда на столе».
- **Сборки НЕТ.** Готовое блюдо → официанту прилетает уведомление (УЖЕ работает) → он разносит по одному/пачкой, как хочет.
- Ярлык стола (`order_id`) кухне для готовки не нужен, НО оставляем — он нужен для **массовой отмены, когда стол уходит** (гости оплатили, но отменили блюда). 
- Отмена блюда = мягкое событие (перечёркнуто), не каскадный снос.

### Навынос (`delivery_type IN ('delivery','pickup')`)
- **«Заказ» существует только здесь.**
- **Сборка есть** (экран `assembly.vue`, УЖЕ исключает dine_in).
- Экран сборки → **2 колонки** (сейчас 3, схлопываем):
  - **Готовится** — на кухне ещё готовят кухонные блюда заказа.
  - **Готово** — все *кухонные* блюда заказа готовы. Внутри карточки:
    - некухонные позиции (`skip_kitchen=true`, напр. банка колы) показаны со своей кнопкой **«Собрать»** у каждой (УЖЕ работает — сейчас это отдельная колонка «collecting»);
    - когда всё собрано → кнопка **«Собрано»** → заказ улетает из сборки (статус → `completedStatusMap`).
  - (Колонка «Отменено» остаётся как сейчас, появляется при наличии отменённых.)

### Главный инвариант (новое правило системы)
> **Контейнер кухни независим от жизни заказа.** Удаление/правка заказа НИКОГДА не уничтожает строку кухни физически — вместо этого строка получает событие «отменено» (`status='cancelled'`). Любой путь, удаляющий `order_items`/`orders` или переводящий заказ в группу `cancelled`, обязан мягко отменить соответствующие строки кухни.

---

## 3. Что УЖЕ работает — НЕ ломать, переиспользовать

| Что | Где | Статус |
|---|---|---|
| Денормализованная копия блюда в строке | `kitchen_queue` schema (`071`) | ✅ есть всё нужное |
| Мягкая отмена | `cancelForOrders`, `cancelItems`, `dismissCancelled`, `dismissCancelledOrder` — `features/kitchen/api/kitchen-queue.ts` | ✅ работает на части путей |
| KDS показывает cancelled перечёркнутым + кнопка «Убрать» | `queue.vue` (`cancelledOnBoard`/`cancelledQueue`), `KitchenQueueItem.vue`, `dismissed_at` фильтр в `listActive` | ✅ |
| Умная подмена при отмене блюда повара | `findSubstitute` (`packages/shared/src/kitchen-helpers.ts`), `KitchenSubstitutionCard.vue`, `queue.vue` onUpdate | ✅ (см. §7 — уже есть незакоммиченный фикс) |
| Сборка исключает dine_in | `listForAssembly` (`.neq('delivery_type','dine_in')`), `assembly.vue` realtime `if dine_in return` | ✅ |
| Группировка сборки по заказу + фазы | `getOrderPhase` (`kitchen-helpers.ts`), `assembly.vue allOrderGroups` | ✅ (фазы менять при слиянии колонок) |
| Некухонные позиции с кнопкой «Собрать» | `assembly.vue onCollectItem`, `KitchenAssemblyCard.vue`, `skip_kitchen` флаг | ✅ (сейчас отдельная колонка) |
| Кнопка «Собрано» → заказ улетает | `assembly.vue onAssembled` → `serveAllForOrders` + `markKitchenCompleted` + `updateStatus(completedStatusMap)` | ✅ |
| Уведомления готовности официанту в зале | экран столов `tables.vue` (`kitchenDishes`, `onServeKitchen`) | ✅ (звук — не трогаем) |
| Наполнение очереди (2 разных пути) | retail: `kitchen_queue_on_order_status`→`kitchen_queue_populate`; dine_in: `kitchen_queue_on_item_confirmed` + `kitchen_queue_on_dine_in_item_insert` | ✅ оставляем как есть |

---

## 4. Change set (точечные правки)

### C1. Снять каскадное удаление с кухни — **DB migration, S**
Сделать клон независимым.
- `kitchen_queue.order_item_id`: `DROP NOT NULL`, FK → `ON DELETE SET NULL`.
- `kitchen_queue.order_id`: `DROP NOT NULL`, FK → `ON DELETE SET NULL`.
- (`tenant_id` cascade ОСТАВИТЬ — удаление тенанта должно чистить.)
**Риск:** после этого удаление заказа/позиции оставляет строки-сироты → их закрывают C2/C3 (мягкая отмена) + C5 (уборка).

### C2. Триггер: переход заказа в группу `cancelled` → мягкая отмена кухни — **DB, M**
Единый исход отмены для ЛЮБОГО UI-пути (inline-смена статуса, drawer-сохранение, RPC).
- Добавить логику в существующий/соседний триггер на `orders` (рядом с `kitchen_queue_on_order_status`): при `OLD.status != NEW.status` И `NEW.status` принадлежит `order_statuses.group_type='cancelled'` →
  `UPDATE kitchen_queue SET status='cancelled' WHERE order_id = NEW.id AND status IN ('queued','in_progress')`.
- Покрывает и зал (стол уходит → сессия стола в cancelled → блюда стола перечёркнуты), и навынос.
**После этого:** фронтовый `cancelForOrders` становится избыточным (можно оставить как есть — не мешает, или убрать вызов в `useOrders.updateStatus`; реши при имплементации, безопаснее оставить).
**Verify:** как именно dine_in «закрытие/уход стола» меняет статус заказа-сессии (есть ли вообще переход в cancelled, или стол просто закрывается). Если стол закрывается иначе — добавить покрытие этого пути.

### C3. Триггер: удаление `order_items` → мягкая отмена его кухни — **DB, S-M**
Точечная отмена при удалении ОДНОГО блюда (не всего заказа): dine_in «удалить блюдо», reject и т.п.
- `BEFORE DELETE ON order_items` триггер:
  `UPDATE kitchen_queue SET status='cancelled' WHERE order_item_id = OLD.id AND status IN ('queued','in_progress')`.
- Срабатывает ДО того, как FK `SET NULL` отвяжет строку → строка остаётся как `cancelled`, отвязанная.
**Риск/связка с C4:** этот триггер сработает и на reinsert внутри `update_order_with_items` (он удаляет позиции) → ложно отменит кухню активного заказа при правке других полей. Поэтому C4 ОБЯЗАТЕЛЕН.

### C4. `update_order_with_items`: не трогать позиции, если они не менялись — **RPC, M (ядро)**
Чтобы правка адреса/телефона/статуса НЕ удаляла+реинсёртила позиции (и не дёргала C3).
- Вариант предпочтительный (фронт): в `OrderContent.vue formPayload` НЕ класть `items`, когда позиции не редактировались. Items в форме редактируемы только при `can.editItems` (= статус-группа `'new'`, см. `useOrderStatus.ts:50`). Значит для заказа, который уже на кухне (группа `in_progress`+), `items` слать как `null` → `update_order_with_items` получит `p_items_json=null` → пропустит весь блок DELETE+reinsert (там уже есть `IF p_items_json IS NOT NULL`).
- Альтернатива (RPC): сравнивать входящие items с текущими, no-op если идентичны. Менее надёжно (нормализация ключей модификаторов). **Предпочесть фронтовый вариант.**
**Эффект:** позиции активного заказа на кухне физически не трогаются никогда (их и так нельзя редактировать после `new`). Значит дублей при reinsert НЕ возникает, C1 безопасен.
**Verify:** что `items` реально редактируемы ТОЛЬКО в группе `new` (прочитать `OrderContent.vue` + `useOrderStatus.ts can`). Если есть путь правки позиций уже на кухне — обработать дубли отдельно (отменить старые + populate новые).

### C5. Уборка старых отменённых строк — **DB, S (можно отложить)**
Сироты/cancelled накапливаются (авто-уборки сейчас НЕТ).
- Периодически (или в `dismissCancelled`) удалять `kitchen_queue` где `status IN ('cancelled','served')` и `created_at < now() - interval '7 days'` (порог обсуждаем). Низкий приоритет, не блокер.

### C6. Сборка: 3 колонки → 2 — **Frontend, S-M**
- `assembly.vue`: объединить `collectingGroups` + `readyGroups` в одну колонку **«Готово»**. Колонку «Готовится» (`cookingGroups`) оставить. «Отменено» оставить условной.
- Карточка `KitchenAssemblyCard.vue`: внутри «Готово» — некухонные позиции (`skip_kitchen`) показаны с кнопкой «Собрать» (уже есть `onCollectItem`); кнопка «Собрано» (`onAssembled`) активна когда всё собрано. Логика «полностью готово vs надо докинуть» — это нынешние фазы `ready`/`collecting`, теперь обе в одной колонке как два состояния карточки.
- `getOrderPhase` (`kitchen-helpers.ts`): можно оставить 4 фазы, но в UI маппить `collecting`+`ready` в одну колонку; либо упростить. Минимально — менять только группировку колонок в `assembly.vue`, фазы не трогать.

### C7. (уже сделано, не терять) findSubstitute не подменяет близнеца из своего же заказа
- Незакоммичено: правка `kitchen-helpers.ts` (`q.orderId !== cancelled.orderId`) + регрешн-тест `apps/admin/features/kitchen/__tests__/cancel-substitution.test.ts`. После C1-C4 подмена реально оживёт (строки выживают) → этот фикс к месту. Сохранить.

---

## 5. Тесты

**Unit/регрешн (vitest):**
- `cancel-substitution.test.ts` — уже есть (C7), оставить зелёным.
- `getOrderPhase` / маппинг колонок сборки после C6 — тест на 2-колоночную группировку и состояния «Готово».
- Если меняется `findSubstitute`/фазы — обновить существующий `kitchen-queue.test.ts` / `useKitchenStatusBlock.test.ts`.

**DB-репродукция (psql, как в расследовании — в транзакции с ROLLBACK):**
- После C1: `DELETE FROM order_items WHERE id=X` → строки `kitchen_queue` НЕ исчезают (раньше 3→0, теперь 3→3 с `order_item_id IS NULL`).
- После C2: `UPDATE orders SET status=<cancelled-group>` → строки кухни заказа → `cancelled` (не удалены).
- После C3: `DELETE FROM order_items WHERE id=X` (одна позиция) → её строки кухни → `cancelled`, не удалены.
- После C4: сохранение заказа без изменения позиций (`p_items_json=null`) → `order_items` не трогаются, строки кухни целы.

**Прогон Deno-тестов edge-функций — не требуется (изменения в БД-триггерах + фронт).**

---

## 6. Ручные тестовые сценарии (браузер, локально)

**Тенант:** «Вкусная точка». Логин: `demo@fastio.app` / `e2e-admin-pass-12345`. Порт admin 4710.
**Подготовка данных:** см. готовые заказы (агент пересоздаст при необходимости — заказы `ТЕСТ-БАГ Классик×3` навынос и `ТЕСТ-ХЭППИ Барбекю×1`; для зала и колы — добавить).

### Навынос
1. **БАГ→ФИКС (отмена через drawer, quantity 3):** взять блюдо в работу → открыть заказ в drawer → статус «Отменён» → Сохранить. Ожидание: 3 карточки остаются перечёркнутыми (раньше исчезали).
2. **Отмена через inline-статус:** то же, но смена статуса из списка. Ожидание: перечёркнуты, не пропали.
3. **Правка поля активного заказа:** заказ на кухне, поправить телефон/адрес → Сохранить. Ожидание: кухня НЕ шелохнулась (ни отмены, ни дублей).
4. **Сборка 2 колонки:** заказ с кухонным блюдом + колой (`skip_kitchen`). Доготовить кухонное → заказ в «Готово» → у колы кнопка «Собрать» → собрать → «Собрано» → заказ улетел.
5. **Подмена (C7):** заказ ×3, взять одно, отменить заказ → карточка повара НЕ улетает в подмену сама на себя.

### Зал (dine_in)
6. **Готовка + разнос:** добавить блюда на стол (подтвердить) → повар готовит → официант видит «готово» на экране стола → разносит. Сборки нет.
7. **Стол уходит / отмена блюд:** отменить блюда стола → на кухне перечёркнуты (не исчезли), официант видит что отменено.
8. **Удаление одного блюда со стола:** убрать блюдо → его кухонная карточка → перечёркнута/cancelled, не пропала молча.

---

## 7. Последовательность работ

1. **C1** (снять каскад) + **C4** (не трогать неизменённые позиции) — вместе, иначе дубли/орфаны. Сразу DB-репро-тесты.
2. **C2** (триггер отмены заказа) + **C3** (триггер удаления позиции) — единая мягкая отмена. DB-репро.
3. **C6** (сборка 2 колонки) + unit-тесты.
4. **C5** (уборка) — опционально/последним.
5. C7 уже в дереве — прогнать весь kitchen-сьют зелёным.
6. Прогон ручных сценариев §6.

**Коммитить только по явной команде юзера.** Миграции — по одной через `docker exec ... psql -f` (НЕ `supabase db reset`).

---

## 8. Исполнителю: проверить ПЕРЕД правками (не верь на слово)
- [ ] `OrderContent.vue` + `useOrderStatus.ts`: позиции редактируемы ТОЛЬКО в группе `new`? (основание для C4). Если нет — план C4 расширить на обработку дублей.
- [ ] Как dine_in «уход/закрытие стола» влияет на статус заказа-сессии (есть ли переход в `cancelled`-группу для C2, или стол закрывается иным механизмом).
- [ ] Нет ли других мест, физически удаляющих `order_items`/`orders` мимо C2/C3 (grep `from('order_items').delete`, `DELETE FROM orders`, RPC).
- [ ] `completedStatusMap` для dine_in = null (у зала нет completed-перехода) — сборка его и так не трогает, подтвердить.
- [ ] Realtime: после C1 `onDelete` в `queue.vue`/`assembly.vue` станет почти не нужен — оставить как страховку, не удалять.

---

## Ключевые файлы
- `supabase/migrations/071_kitchen_queue_system.sql` — каскадные FK (C1)
- `supabase/migrations/093_requires_kitchen.sql` — актуальные populate/insert/confirm триггеры
- `supabase/migrations/141_kitchen_queue_skip_repopulate.sql` — `kitchen_queue_on_order_status` + guard (C2 рядом)
- `supabase/migrations/295_delete_order_item_atomic.sql`, `296_promo_code_lifecycle_atomic.sql` — пути удаления (C3/C4)
- `apps/admin/features/kitchen/api/kitchen-queue.ts` — soft-cancel API
- `apps/admin/features/orders/api/orders.ts` — `update`/`removeItem` (C4)
- `apps/admin/features/orders/components/OrderContent.vue` — `formPayload` (C4)
- `apps/admin/features/orders/composables/useOrders.ts` — inline cancel (C2 контекст)
- `apps/admin/pages/kitchen/assembly.vue`, `features/kitchen/components/KitchenAssemblyCard.vue` — сборка (C6)
- `apps/admin/pages/kitchen/queue.vue` — KDS realtime
- `packages/shared/src/kitchen-helpers.ts` — `findSubstitute` (C7), `getOrderPhase` (C6)
- KB к обновлению при коммите: `packages/kb/content/*` (кухня/заказы)
