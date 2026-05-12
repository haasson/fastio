# __FEATURE_KEY__ — заметка для агента

TODO: одно предложение что делает модуль. Полная мета — `feature.manifest.ts`.

## Что модуль делает

TODO: пара предложений — что хранит, кто использует, как связан с другими фичами. Если данные приходят через `server/api/*` — упомяни какие endpoints (это не дубль manifest.dependsOn — это нужно для понимания flow).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/__feature__.ts` | Обёртки над `$fetch('/api/__feature__/...')` (если фича дёргает Nitro) |
| `composables/use__Feature__.ts` | Локальное состояние + методы |
| `stores/__feature__.ts` | Pinia-стор (только если состояние нужно нескольким страницам/компонентам) |
| `types.ts` | Реэкспорты доменных типов (обычно из `packages/shared`) |

## Типовые задачи

- **Новое поле на форме:** UI → composable state → серверный endpoint (`server/api/__feature__/...`) → миграция БД если нужно.
- **Новый запрос на сервер:** добавь обёртку в `api/__feature__.ts`, используй в composable. На стороне сервера — endpoint в `apps/storefront/server/api/__feature__/...`.
- **Новая страница:** клади в `apps/storefront/pages/__FEATURE_KEY__/<name>.vue`, **НЕ** в `features/__FEATURE_KEY__/components/`.

## Антипаттерны (не делай так)

- ❌ Прямой `useSupabaseClient().from(...)` из компонента — пиши через `api/__feature__.ts` или (лучше) через Nitro endpoint `server/api/__feature__/*` чтобы RLS и tenant-isolation работали стабильно.
- ❌ Импорт `features/__FEATURE_KEY__/api/...` или `composables/...` снаружи модуля — только через `~/features/__FEATURE_KEY__` (barrel).
- ❌ Хардкодить логику валидации/расчётов в компоненте — выноси в `utils/` фичи или в `@fastio/shared`.
- ❌ TODO: добавь свои специфичные «не делай так» в процессе разработки.

## Куда расти

TODO: смежные требования, которые логичнее ляжут сюда.
