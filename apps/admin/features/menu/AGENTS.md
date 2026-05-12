# menu — заметка для агента

Меню витрины (retail): категории → блюда → модификаторы/аддоны/комбо. Полная мета — в `feature.manifest.ts`.

## Что модуль делает

CRUD каталога. Sub-модули `modifiers`, `addons`, `combos` — toggleable через TenantModules; UI гейтится через `useGate.retail`. Цены/доступность блюд → витрина и заказы.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/categories.ts` | CRUD категорий + drag-n-drop reorder |
| `api/dishes.ts` | CRUD блюд + связи с модификаторами/аддонами |
| `api/modifiers.ts` | Группы модификаторов и опции |
| `api/addons.ts` | Аддоны и пресеты |
| `api/combos.ts` | Комбо-наборы |
| `composables/useDishes.ts` | Realtime-список блюд (на `useRealtimeList`) |
| `composables/useDishSave.ts` | Сохранение блюда с зависимостями (модификаторы, аддоны) одной транзакцией |
| `composables/useDishTable.ts` | Колонки/фильтры таблицы блюд |
| `composables/useDishModifiersEditor.ts` | UI-state модификаторов в drawer'е блюда |
| `composables/useModifierGroups.ts` | Realtime-список групп модификаторов |
| `composables/useAddons.ts` | Realtime-список аддонов + пресетов |
| `composables/useCombos.ts` | Realtime-список комбо-наборов |
| `composables/useDishCounts.ts` | Счётчики (для бейджей в навигации) |
| `components/DishPickerModal.vue` | **Cross-module API.** Реэкспортится из barrel — используется в `orders`/`promotions`. |

## Типовые задачи

- **Новое поле блюда:**
  1. Миграция + тип `Dish` в `packages/shared/src/types/dish.ts`
  2. `mapDish` (в `@fastio/shared`, не локальный) + `SELECT_FIELDS` в `api/dishes.ts`
  3. Поле в `useDishSave` если редактируется
  4. UI в `components/DishFormDrawer.vue` + колонка в `useDishTable`

- **Новый sub-модуль (тег, секция и т.п.):** новый `api/<name>.ts` + `composables/use<Name>.ts`. Не забудь добавить в barrel + если модуль toggleable — расширить `TenantModules` и завести `key` в `config/modules.ts`.

- **Pricing-логика:** идёт в `@fastio/shared/utils/pricing` (или domain util), **не** в этой фиче. Эта фича знает только про хранение.

## Антипаттерны (не делай так)

- ❌ Импортировать `features/menu/api/...` снаружи — только через `useDatabase().{dishes,categories,...}` или barrel.
- ❌ Класть `DishPickerModal` deep-path при использовании из `orders/promotions` — он специально реэкспортится из barrel.
- ❌ Дублировать `mapDish`/типы — они в `@fastio/shared`.
- ❌ Конструировать ценник на лету в компоненте — `@fastio/shared` уже умеет (`formatPrice`, `applyModifiers`).
- ❌ Перетирать `dish_modifier_groups`/`dish_modifier_options` через прямой `update` — это композитные таблицы, идёт через `useDishSave` транзакционно.

## Куда расти

Логика про availability/расписания доступности блюд — в `@fastio/shared/scheduling`. Логика про seasonality/планирование — в новую фичу, не сюда.
