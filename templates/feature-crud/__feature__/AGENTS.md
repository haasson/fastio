# __FEATURE_KEY__ — заметка для агента

TODO: одно предложение что делает модуль. Полная мета — `feature.manifest.ts`.

## Что модуль делает

TODO: пара предложений — что хранит, кто использует, как связан с другими фичами.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/__feature__.ts` | CRUD-обёртки `__FEATURE_CAMEL__sApi` |
| `composables/use__Feature__.ts` | Состояние списка + realtime-обработчики |
| `composables/use__Feature__Channel.ts` | **Глобальный realtime-канал. Вызывать ОДИН раз в layout.** Эмитит `__FEATURE_CAMEL__Events` |
| `stores/__feature__.ts` | Pinia-стор (опционально, если состояние нужно глобально) |
| `types.ts` | Реэкспорты доменных типов |

## Типовые задачи

- **Новое поле сущности:**
  1. Миграция в supabase/migrations/
  2. Тип `__FEATURE_PASCAL__` в `packages/shared/src/types/__feature_camel__.ts`
  3. `map` и `SELECT_FIELDS` в `api/__feature__.ts`
  4. UI

- **Новый метод API:** добавь в `__FEATURE_CAMEL__sApi`, потом обёртку в `use__FEATURE_PASCAL__s`, потом UI кнопку.

- **Новая страница:** клади в `apps/admin/pages/__FEATURE_KEY__/<name>.vue`, **НЕ** в `features/__FEATURE_KEY__/components/`.

## Антипаттерны (не делай так)

- ❌ Создавать второй realtime-канал на `__TABLE__` — он один (`use__FEATURE_PASCAL__sChannel`). Подписывайся на события через `__FEATURE_CAMEL__Events.onInsert/onUpdate/onDelete`.
- ❌ Импортировать `features/__FEATURE_KEY__/api/...` снаружи модуля — только через `useDatabase().__FEATURE_CAMEL__s` или barrel.
- ❌ Хардкодить логику валидации/расчётов в компоненте — выноси в `utils/` фичи или в `@fastio/shared`.
- ❌ TODO: добавь свои специфичные «не делай так» в процессе разработки.

## Куда расти

TODO: если будут смежные требования, куда они логичнее лягут.
