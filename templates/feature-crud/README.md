# feature-crud — шаблон новой фичи admin

Заготовка для нового модуля `apps/admin/features/<X>/` с базовым CRUD + realtime + store. Скопируй в `features/`, прогони замены и доделай по месту.

## Что внутри

```
__feature__/
  api/__feature__.ts              — CRUD-обёртки над supabase.from('__table__')
  composables/use__Feature__.ts   — состояние списка + realtime-обработчики
  composables/use__Feature__Channel.ts — единственный realtime-канал (вызывать в layout)
  stores/__feature__.ts           — Pinia setup-стор (опционально)
  components/                     — пусто, добавь по месту
  __tests__/                      — пусто, добавь по месту
  types.ts                        — реэкспорты типов (если фиче нужны cross-module типы)
  index.ts                        — barrel (можешь оставить как авто-генерируемый)
  feature.manifest.ts             — машиночитаемый манифест (заполни TODO)
  AGENTS.md                       — заметка для агента (заполни TODO)
```

## Как использовать

**Способ 1 (рекомендован):** скрипт `pnpm new:feature`:
```bash
pnpm new:feature bookings --singular=booking --vertical=retail --purpose="Бронирования столов"
```
Без флагов — попросит ввести интерактивно. Скрипт сам копирует, переименовывает, делает replace.

**Способ 2:** руками — для копипасты в нестандартном случае:

1. Скопируй директорию шаблона в `apps/admin/features/<your-feature>/`:
   ```bash
   cp -R templates/feature-crud/__feature__ apps/admin/features/bookings
   ```
2. Переименуй файлы (замени `__feature__`/`__Feature__` на camelCase/PascalCase singular):
   ```bash
   cd apps/admin/features/bookings
   for f in $(find . -name '*__Feature__*'); do mv "$f" "${f//__Feature__/Booking}"; done
   for f in $(find . -name '*__feature__*'); do mv "$f" "${f//__feature__/booking}"; done
   ```
3. Прогони find+replace по содержимому (выбери что-то одно — sed, IDE, или агент):

   | Плейсхолдер | Что подставить | Пример |
   |---|---|---|
   | `__FEATURE_KEY__` | kebab-case ключ модуля (== имя папки) | `bookings` |
   | `__FEATURE_PASCAL__` | PascalCase для типов/имён | `Booking` |
   | `__FEATURE_CAMEL__` | camelCase для переменных | `booking` |
   | `__TABLE__` | имя таблицы в Supabase | `bookings` |
   | `__VERTICAL__` | `retail` / `services` / `shared` | `retail` |
   | `__PURPOSE__` | одна строка зачем модуль | `Бронирования столов` |

4. Открой `feature.manifest.ts` — заполни `permissions`, `db.tables`, `db.rpc`, `routes`, `dependsOn`.
5. Открой `AGENTS.md` — пройди по TODO-комментариям, заполни «Карту модуля» / «Типовые задачи» / «Антипаттерны».
6. Прогони:
   ```bash
   pnpm features:validate   # проверит манифест
   pnpm typecheck           # проверит код
   ```
7. Не забудь:
   - Добавить страницы в `apps/admin/pages/__feature_key__/*.vue` (если нужны)
   - Зарегистрировать permissions в `apps/admin/config/team-roles.ts` (если новые)
   - Если фича toggleable — добавить ключ в `TenantModules` (packages/shared/src/types/tenant.ts) и в `apps/admin/config/modules.ts`
   - Подключить API в `apps/admin/shared/data/useDatabase.ts` если хочешь доступ через `useDatabase().__feature_camel__`

## Если фича без realtime

Удали `composables/use__feature__Channel.ts` и блок `realtime` в манифесте.

## Если фича без store

Удали `stores/` — не каждая фича нуждается в глобальном Pinia-сторе.
