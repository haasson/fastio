# audit-log — заметка для агента

Журнал аудита (shared). Полная мета — `feature.manifest.ts`.

## Что модуль делает

Append-only лог действий: кто (`actor_id`), на чём (`entity_type`/`entity_id`), какое действие (`action`), когда (`created_at`), детали (`metadata` jsonb). Фича гейтится feature-флагом `AUDIT_LOG_ENABLED` в `shared/utils/featureFlags` (бета-функциональность).

**Запись в `audit_logs` идёт не отсюда** — каждая фича сама пишет события через свой `*EventLogger` (например, `useOrderEventLogger`) или RPC. Эта фича отвечает только за **чтение** и UI.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/audit-logs.ts` | `list` с фильтрами + пагинация |
| `composables/useAuditLog.ts` | Состояние страницы: фильтры, пагинация, refresh |
| `utils/audit.ts` | Чистые форматтеры: имя действия по `action`+`entity_type`, иконка, цвет |

## Типовые задачи

- **Новое отслеживаемое действие:** не в этой фиче. Идёшь в фичу-владелец сущности (например, `features/orders`) и в её `useXxxEventLogger` добавляешь новое событие. Авто-формат подхватится тут, если узнаваемый `action`.
- **Новая колонка фильтра:** расширь `AuditLogFilters` тип + поле в `api/audit-logs.list()` + UI.
- **Включить в проде:** AUDIT_LOG_ENABLED управляется через env-флаг — см. `shared/utils/featureFlags.ts`.

## Антипаттерны (не делай так)

- ❌ Писать в `audit_logs` из этой фичи — это write-only из других модулей.
- ❌ UPDATE/DELETE на `audit_logs` — append-only, RLS должна это блокировать.
- ❌ Полагаться на realtime `audit_logs` — события могут идти лавиной, фронт пагинирует с refresh-кнопкой.

## Куда расти

Экспорт CSV/PDF — добавь `api/audit-logs.export()` + UI кнопку. Не делай это generic'ом через UI таблицы — у audit-log специфичный формат строк (markdown в `metadata`).
