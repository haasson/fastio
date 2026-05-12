# branch — заметка для агента

Выбор филиала гостем. Shared aggregator (нужен и retail-flow, и services-flow).

## Что модуль делает

`useSelectedBranchStore` хранит `id` текущего филиала + `name` (для UI), персистится в localStorage через `plugins/branch-restore.client.ts`. Влияет на:
- какие блюда показывать (фильтр по `dish.branchIds`)
- какие услуги доступны (фильтр по `service.branchIds` + `resource.branchIds`)
- какой `branchId` ставить в бронь стола / запись на услугу

`useBranchSwitcher` — composable для смены филиала с проверкой корзины:
- Вычисляет `branchCompat` (какие позиции корзины совместимы с новым филиалом)
- Если есть несовместимые — показывает confirm-диалог «удалить X позиций?»
- При подтверждении — переключает + чистит корзину от несовместимого

## Карта модуля

| Файл | Что внутри |
|---|---|
| `stores/selectedBranch.ts` | `useSelectedBranchStore` — id + name + computed isSelected + setBranch/clear |
| `composables/useBranchSwitcher.ts` | `useBranchSwitcher` — smart-switch с валидацией корзины |
| `components/BranchPickerModal.vue` | Модалка выбора филиала (список + геопоиск ближайшего) |
| `components/BranchAvailabilityHint.vue` | Inline-плашка «Доступно в X из Y филиалов» (на DishModal / ServiceModal) |

## Типовые задачи

- **Изменить логику ranking филиалов:** правь sorting в `BranchPickerModal.vue` или вынеси в `~/features/branch/utils/`.
- **Добавить геолокацию-сорт:** интегрируется в `BranchPickerModal`, использует Geolocation API. См. WISHLIST «Branch-awareness».

## Антипаттерны (не делай так)

- ❌ Прямой `localStorage.getItem('branch_id')` из компонента — используй `useSelectedBranchStore` или `plugins/branch-restore.client.ts`.
- ❌ Смена филиала через `selectedBranch.setBranch()` без `useBranchSwitcher` — потеряешь cart-валидацию.
- ❌ Импорт `~/stores/selectedBranch` или `~/composables/useBranchSwitcher` (старые пути) — через `~/features/branch`.

## Куда расти

- **Branch-awareness в appointments** (WISHLIST/design-doc): расширить selector чтобы фильтровать услуги/мастеров. Хук есть, реализация — TODO.
- **Геосортировка** (WISHLIST): использовать `useGeolocation` (есть в `@vueuse/core`) и сортировать по расстоянию.

## Fat-deps trigger

Модуль зависит от трёх других: `cart`, `menu-catalog`, `services-catalog` —
из-за того что `useBranchSwitcher` живёт здесь и координирует cleanup корзины.
Норма, не рефакторить превентивно.

**Когда рефакторить:** если `useBranchSwitcher` вырос >150 строк ИЛИ появилась
третья независимая точка вызова reconciler'а (помимо `branch` и `cart-restore`
plugin'а). Тогда: перенести `useBranchSwitcher` в `features/cart/composables/`,
оставить здесь только `useSelectedBranchStore` + UI.
