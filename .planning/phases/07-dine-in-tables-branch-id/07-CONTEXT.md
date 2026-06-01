# Phase 7: Привязка столов dine-in к филиалу (tables.branch_id) - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Сделать dine-in столы branch-aware, чтобы заказ со стола маршрутизировался в правильный филиал (кухонная очередь, уведомления, нумерация заказов).

**Корень бага:** таблица `tables` не имеет `branch_id` → столы тенант-глобальные. В `order-delivery.ts` ветка привязки филиала для dine_in не срабатывает на мультифилиальном тенанте (pickup-ветка не подходит, «единственный филиал» — нет, для dine_in `null` разрешён) → dine-in заказ создаётся с `branch_id=null` → не виден ни в одной кухонной очереди (кухня фильтрует по `orders.branch_id`). P0 для мультифилиального dine-in.

**В границах:** схема `tables.branch_id` + бэкфилл + RLS; админка `features/tables` (branch-scoped управление); storefront `order-delivery.ts` (маршрутизация dine_in); edge (archive guard, пер-филиальный префикс номера применяется автоматически).

**Вне границ:** новые возможности столов; пофилиальное меню/цены; богатый дашборд занятости.
</domain>

<decisions>
## Implementation Decisions

### Модель привязки (схема + UI)
- **D-01:** `tables.branch_id` — **nullable** FK на `branches(id)` (`ON DELETE` см. D-10). Не NOT NULL: защищает от хрупкости миграции и тенантов без филиалов на момент наката.
- **D-02:** Отдельного пер-стольного дропдауна филиала **НЕ делаем**. Филиал столу проставляется = глобально выбранный филиал в сайдбаре в момент создания. Источник: `apps/admin/shared/stores/branch.ts` → `currentBranchId` (`null` = «Все филиалы», см. `features/branches/composables/useBranch.ts:14`).
- **D-03:** Страница столов реагирует на глобальный селектор (как заказы/кухня). Создание стола → `branch_id = currentBranchId`.

### Поведение по числу филиалов
- **D-04:** `branches.length <= 1` → всегда показываем столы единственного филиала, состояние «Все/конкретный» игнорим. Для single-branch (большинство) — UX «как раньше», без трения. Это снимает ловушку: владелец single-branch по умолчанию сидит в `currentBranchId=null` (все), и без этой развязки упирался бы в саммари вместо своих столов.
- **D-05:** `branches.length > 1` + конкретный филиал → столы этого филиала (создание/редактирование/раскладка).
- **D-06:** `branches.length > 1` + «Все филиалы» (`null`) → **лёгкая саммари-страница**: список филиалов с числом столов (`N столов · M занято`), клик по строке → `setBranch(branchId)` → переключает глобальный селектор и проваливает в редактируемый список филиала. «Все» становится обзором + точкой входа, не тупиком. Богатую начинку (реалтайм-занятость, вызовы по филиалам) — отложить.
- **D-07:** `/tables/layout` (визуальный план зала) доступен только при конкретном филиале. При «Все» (мультибранч) — та же саммари/редирект на выбор филиала.

### Бэкфилл существующих столов (миграция)
- **D-08:** Умный бэкфилл: тенант с **одним** филиалом → все его столы привязываем к нему автоматически (двусмысленности нет). Тенант с **несколькими** → оставляем `null` + показываем в админке алерт «назначьте филиал каждому столу». НЕ привязывать всех к «первому» — у мультибранч это разложит столы по неверному филиалу. (На проде у T1 сейчас 0 столов — для текущего теста бэкфилл moot, но миграция обязана корректно отработать у всех тенантов.)

### Влияние на витрину
- **D-09:** Филиал стола **только маршрутизирует заказ** на нужную кухню. Меню на `/table/<id>` остаётся тенант-глобальным, по филиалу НЕ фильтруется. Совпадает с текущей реальностью: пер-филиальные цены дропнуты (миграция 129), `branchSelectionMode` скрыт.

### Archive guard
- **D-10:** При попытке архивировать/удалить филиал, к которому привязаны столы → **блокировать** с сообщением («у филиала есть столы — перенесите или удалите их»), в одном стиле с существующим гардом по активным броням/записям. FK поведение согласовать с этим (блок на уровне приложения; на уровне БД — `ON DELETE SET NULL` или `RESTRICT`, решит планер вместе с тем, как реализован текущий guard).

### Storefront fix (ядро P0)
- **D-11:** `validateTable` (`order-delivery.ts`) добавляет `branch_id` в select и возвращает его в `TableRecord`. `resolveDelivery` для `dine_in` ставит `branchId = tableRecord.branchId`. После этого кухонный фильтр (проверен в 3.6.4) заработает для dine-in автоматически, и пер-филиальный префикс номера (`orderNumberConfig.scope=per_branch`) тоже применится без доп. кода.
- **D-12:** Если стол по какой-то причине без филиала (`branch_id=null`) — для dine_in применить тот же fallback, что и сейчас (единственный филиал), а при мультибранче без филиала у стола — это конфиг-ошибка тенанта; решить (ошибка чекаута vs мягкий fallback) на плане, но НЕ допускать тихого `null` на мультибранче.

### Claude's Discretion
- Точная форма саммари-карточки (UiCard/UiListRow), иконки, тексты.
- `ON DELETE` стратегия FK (в связке с реализацией archive guard).
- Где именно живёт алерт «назначьте филиал» (страница столов vs `/branches`).
</decisions>

<specifics>
## Specific Ideas

- Саммари «Все филиалы» по образцу остальных branch-scoped страниц админки — клик переключает **глобальный** селектор через `setBranch`, а не локальное состояние.
- Single-branch тенант не должен ощущать никаких изменений (нет лишнего выбора филиала).
</specifics>

<canonical_refs>
## Canonical References

Внешних спек/ADR для этой фазы нет — требования полностью зафиксированы в decisions выше. Ключевые опорные файлы кода — в code_context.

- `TESTING_NOTES.md` § «3.7 Столы и QR» — запись находки (столы не привязаны к филиалу), контекст обнаружения.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/admin/shared/stores/branch.ts` + `apps/admin/features/branches/composables/useBranch.ts` — глобальный селектор филиала. `currentBranchId: string | null`, `null` = «Все филиалы»; `setBranch(id)` переключает (persist в localStorage). Владелец/all-access по умолчанию `null`.
- `apps/admin/features/tables/` — `types.ts`, `api/tables.ts`, компоненты (форма/список стола), `composables/useTablesChannel.ts`, `useTableCallsChannel.ts` (realtime). Сюда добавляется branch-логика.
- Существующий branch-archive guard (`fix(branch-archive-guard)`) по броням/appointments — образец для D-10 (точное место найдёт планер).
- `orderNumberConfig.scope = per_branch` — пер-филиальная нумерация уже есть, применится к dine-in автоматически после D-11.

### Established Patterns
- Branch-scoped страницы (orders, kitchen) уже фильтруют по `currentBranchId` — столы следуют тому же паттерну (проверено в 3.6.4: кухня фильтрует по `orders.branch_id`).
- `tables` схема (прод): `id, tenant_id, name, is_open, is_active, opened_at, capacity, tags, position_x, position_y, shape, table_width, table_height, rotation, color, notes, created_at` — нет `branch_id`, нет связки с филиалом нигде (ни join-таблицы).

### Integration Points
- `apps/storefront/server/services/order-delivery.ts`:
  - `validateTable` (стр. ~21) — select `id, name, is_open` → добавить `branch_id`, вернуть в `TableRecord`.
  - `resolveDelivery` (стр. ~115, блок `if (!branchId)`) — для `dine_in` ставить `branchId = tableRecord.branchId`; убрать тихий `null` на мультибранче.
- `apps/storefront/server/api/orders.post.ts:121` — пишет `branch_id: branchId ?? null` (уже готов принять корректный branchId).
- `supabase/migrations/` — новая миграция (последняя на проде — 306) для `tables.branch_id` + бэкфилл + RLS.
- RLS на `tables`/`table_calls` — проверить, что чтение/запись с branch-фильтром не ломает существующие политики.
</code_context>

<deferred>
## Deferred Ideas

- Богатый дашборд «Все филиалы»: реалтайм-занятость столов, вызовы официанта по филиалам в саммари. (MVP — только счётчики `N столов · M занято`.)
- Пофилиальное меню/доступность блюд на странице стола (`dish_branches`) — отдельная тема, сейчас режим выключен.
- Перенос стола между филиалами как явная операция (drag/reassign) — если понадобится после внедрения базовой привязки.
</deferred>

---

*Phase: 07-dine-in-tables-branch-id*
*Context gathered: 2026-06-01*
