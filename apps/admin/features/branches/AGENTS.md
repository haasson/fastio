# branches — заметка для агента

Филиалы тенанта (shared, toggleable `branches`). Полная мета — `feature.manifest.ts`.

## Что модуль делает

Multi-tenancy внутри тенанта: один тенант — N филиалов. Каждый заказ/бронь/запись привязан к `branch_id`. Если модуль `branches=false` — у тенанта один дефолтный филиал, UI селектора филиала скрыт.

**Особенность:** `shared/stores/branch.ts` — это глобальный стор текущего выбранного филиала, который пользуют ВСЕ фичи (`useBranchStore().currentBranchId`). Сама фича `branches` управляет CRUD, стор — отдельный (в shared, потому что используется везде).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/branches.ts` | CRUD филиалов + reorder |
| `composables/useBranches.ts` | Realtime-список филиалов тенанта |
| `composables/useBranch.ts` | Один филиал по id (для drawer'а настроек) |
| `composables/useBranchToggle.ts` | Toggle активности филиала с проверкой блокеров |
| `utils/branch.ts` | Чистая утилка: `formatBranchAddress`, `branchTimeZone` |

## Типовые задачи

- **Новое поле филиала:** миграция + `Branch` тип в `@fastio/shared` + `mapBranch` + `api/branches`.
- **Сменить текущий филиал глобально:** не из фичи! Используй `useBranchStore().setCurrentBranch(id)` — это автоматически перепереподпишется на realtime и подгрузит данные.
- **Часы работы филиала:** поле `branches.opening_hours` (jsonb), парсинг — `@fastio/shared/scheduling/openingHours`.

## Антипаттерны (не делай так)

- ❌ Импортировать `useBranchStore` из фичи `branches` — он в `shared/stores/branch.ts` (потому что глобальный).
- ❌ Фильтровать данные по `currentBranchId` в каждом компоненте — это делается в composable'ах на уровне фичи через `useRealtimeList({ branchId })`.
- ❌ Удалять филиал «жёстко» — есть soft-archive (`branches.archived_at`), потому что на него ссылаются старые заказы/брони.

## Куда расти

Гео-логика (карта филиалов, ближайший к гостю) — переноси в `@fastio/shared/geo` (там уже есть `getDistance` / `useDadataSuggestions`).
