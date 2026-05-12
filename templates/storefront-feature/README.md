# storefront-feature — шаблон новой фичи storefront

Заготовка для нового модуля `apps/storefront/features/<X>/`. Storefront-фичи обычно тоньше admin (нет RBAC, нет module-toggle, основная коммуникация — через Nitro endpoints `server/api/*`).

## Что внутри

```
__feature__/
  api/__feature__.ts              — обёртки над $fetch('/api/__feature__/...') (опц., удали если не нужен)
  composables/use__Feature__.ts   — локальное состояние + методы
  stores/__feature__.ts           — Pinia-стор (опц., удали если не нужен)
  components/                     — пусто, добавь по месту
  __tests__/                      — пусто, добавь по месту
  types.ts                        — реэкспорты типов (если фиче нужны cross-module типы)
  index.ts                        — barrel (можешь оставить как авто-генерируемый)
  feature.manifest.ts             — машиночитаемый манифест (заполни TODO)
  AGENTS.md                       — заметка для агента (заполни TODO)
```

## Как использовать

**Способ 1 (рекомендован):** скрипт `pnpm new:storefront-feature`:
```bash
pnpm new:storefront-feature booking --vertical=services --purpose="Онлайн-запись"
```
Без флагов — попросит ввести интерактивно. Скрипт сам копирует, переименовывает, делает replace.

**Способ 2:** руками — копипастой:

1. Скопируй директорию шаблона в `apps/storefront/features/<your-feature>/`:
   ```bash
   cp -R templates/storefront-feature/__feature__ apps/storefront/features/booking
   ```
2. Переименуй файлы (замени `__feature__`/`__Feature__` на нужное):
   ```bash
   cd apps/storefront/features/booking
   for f in $(find . -name '*__Feature__*'); do mv "$f" "${f//__Feature__/Booking}"; done
   for f in $(find . -name '*__feature__*'); do mv "$f" "${f//__feature__/booking}"; done
   ```
3. Прогони find+replace по содержимому:

   | Плейсхолдер | Что подставить | Пример |
   |---|---|---|
   | `__FEATURE_KEY__` | kebab-case ключ модуля (== имя папки) | `booking` |
   | `__FEATURE_PASCAL__` | PascalCase для типов/имён | `Booking` |
   | `__FEATURE_CAMEL__` | camelCase для переменных | `booking` |
   | `__TABLE__` | имя таблицы (если используется) | `appointments` |
   | `__VERTICAL__` | `retail` / `services` / `shared` | `services` |
   | `__PURPOSE__` | одна строка зачем модуль | `Онлайн-запись` |

4. Открой `feature.manifest.ts` — заполни `routes`, `db.tables`/`rpc`, `dependsOn`. Если фича без realtime — удали блок.
5. Открой `AGENTS.md` — пройди по TODO-комментариям.
6. Прогони:
   ```bash
   pnpm storefront-features:validate
   pnpm --filter storefront typecheck
   ```
7. Не забудь:
   - Добавить страницы в `apps/storefront/pages/__feature_key__/*.vue` если нужны
   - Если есть серверная часть — добавь endpoints в `apps/storefront/server/api/__feature_key__/*.ts`

## Если фича без серверного API

Удали `api/__feature__.ts`, скорректируй `composables/use__feature__.ts` (не импортит из api), убери `export * from './api/__feature__'` из barrel.

## Если фича без store

Удали `stores/__feature__.ts`, убери его из barrel.
