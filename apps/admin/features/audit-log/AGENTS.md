# audit-log — заметка для агента

Generic-журнал изменений: кто что менял в справочниках, настройках, команде, операционных сущностях. Полная мета — `feature.manifest.ts`.

## Как пишется (ВАЖНО — изменилось)

**Запись в `audit_logs` идёт БД-триггерами, НЕ из фронта.** Миграция `321_audit_logs_triggers.sql`:
одна generic-функция `fn_audit()` навешена триггером (19 шт.) на каждую чувствительную таблицу
(dishes, categories, modifier_groups/options, addons, addon_presets, combos/items, dish_tags, branches,
tenant_roles, tenant_members, tenant_invitations, tables, reservations, services, promo_codes, promotions,
+ настройки `tenants` через `entity_type='settings'`, только UPDATE с WHEN-allow-list по настроечным колонкам).

Параметры триггера `fn_audit(entity_type, name_col, parent_spec, actor_fallback_col, tenant_id_col)`:
`name_col` поддерживает `'-'` (нет имени) и `'user:<col>'` (ФИО из auth.users); `tenant_id_col` дефолт `'tenant_id'`, для самой `tenants` — `'id'`; `actor_fallback_col` — актор из доменной колонки при service-role (invitations.invited_by).

Триггер сам берёт актора (`auth.uid()` → имя из `auth.users`, роль из `tenant_members.role_id`),
строит дифф по изменившимся колонкам (игнор `sort_order/created_at/updated_at` — reorder не логируем),
пишет `payload` (дифф `{field:{old,new}}`), `changed_fields` (en-ключи), `search_text` (trgm-поиск),
`parent_type`/`parent_id` (дочка → родитель, напр. опция → группа модификаторов).

Гарантия: ни одна мутация этих таблиц не пройдёт без записи. Обойти из кода нельзя.

Заказы и записи — НЕ здесь: у них свои `order_events` / `appointment_events` (rich-лента). В `audit_logs` не дублируются.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/audit-logs.ts` | `list` (фильтры + trgm-поиск), `listForEntity` (история одной сущности, опц. с дочками). Только чтение |
| `composables/useAuditLog.ts` | `list`, `listForEntity`, `enabled` (фиче-флаг). Только чтение — записи из фронта нет |
| `utils/audit-labels.ts` | en→ru: `entityTypeLabel`, `actionMeta`, `fieldLabel`, `renderChanges` (дифф для рендера) |
| `components/AuditTrail.vue` | Встраиваемая панель истории сущности. Props: `entityType`, `entityId`, `includeChildren`, `refreshKey`. Импорт deep-path |
| `pages/audit-log.vue` (в `apps/admin/pages`) | Глобальная страница: фильтры (тип/действие) + поиск |

## Типовые задачи

- **Добавить аудит новой сущности:** миграция с `CREATE TRIGGER ... EXECUTE FUNCTION fn_audit('<entity_type>', '<name_col>|-|user:<col>', '<parent_spec>')`. Затем добавь лейблы в `audit-labels.ts` (ENTITY_TYPE_LABELS + поля).
- **Встроить историю в карточку/дровер:** `<AuditTrail entity-type="dish" :entity-id="id" :refresh-key="key" />`. Для родителя с дочками — `:include-children="true" :show-entity="true"`.
- **Новый фильтр на странице:** расширь `AuditLogsListParams` + ветку в `api/audit-logs.list()` + UI.
- **Включён в проде:** флаг `auditLogEnabled` (`shared/utils/featureFlags`). Право чтения — `audit_log.view` (овнер видит всегда; кастомным ролям выдать в правах).

## Антипаттерны

- ❌ Возвращать ручную запись в `audit_logs` из фронта — для триггерных сущностей будет двойная запись. Запись только триггерами.
- ❌ UPDATE/DELETE на `audit_logs` — append-only.
- ❌ Логировать reorder/`sort_order` — намеренно игнорируется в триггере.
- ❌ Тащить заказы/записи в `audit_logs` — у них свои `*_events`.
