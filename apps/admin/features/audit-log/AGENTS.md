# audit-log — заметка для агента

Generic-журнал изменений: кто что менял в справочниках, настройках, команде, операционных сущностях. Страница `/audit-log` показывает ЕДИНУЮ ленту: аудит конфигурации (`audit_logs`) + события заказов (`order_events`) через RPC `journal_events()`. Полная мета — `feature.manifest.ts`.

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

Заказы и записи пишутся НЕ сюда: у них свои `order_events` / `appointment_events` (rich-лента). В `audit_logs` не дублируются — но в ЧИТАЮЩЕМ слое (`journal_events()`) order-события смешиваются с аудитом в одну ленту.

## Read-слой: RPC `journal_events()` (миграция 328)

`SECURITY DEFINER` с гардом `has_permission('audit_log.view')`. UNION `audit_logs` + `order_events⋈orders` в нормализованную форму. Ключевое:

- **Keyset-пагинация composite `(occurred_at, id)`** — bulk-триггер пишет одинаковый `created_at`, курсор только по времени терял строки. `loadMore` шлёт `p_before` + `p_before_id`.
- **Нормализация order-событий:** `event_type` → `created`/`updated` (для маркера действия и фильтра), сырой тип уходит в `payload._order_event` — из него фронт (`journal-row.ts` + `formatEventText` из `features/orders`) строит сводку для колонки «Изменения». Dine-in заказ (`table_id IS NOT NULL`) показывается как объект-СТОЛ, иначе — заказ с номером.
- **branch-скоуп:** `p_branch_id` отдаёт филиал + общие (`branch_id IS NULL` = «Всё заведение»). `audit_logs.branch_id` — плоский uuid БЕЗ FK (forensic: переживает hard-DELETE филиала), populate generic-способом в `fn_audit()`.
- `p_search` экранирует LIKE-спецсимволы; `p_limit` клампится (1..200).
- **Период (миграция 329):** `p_from` (включительно) / `p_to` (ЭКСКЛЮЗИВНО — фронт шлёт начало дня после выбранного «до», день входит целиком). Оба NULL = весь журнал.
- **`actor_email` (миграция 330):** LIVE-join `auth.users` по `actor_id`, НЕ snapshot — у удалённого юзера email NULL (FK `ON DELETE SET NULL` обнуляет `actor_id`), имя-snapshot в `actor_name` остаётся; смена почты сразу видна в журнале. Колонка «Сотрудник» показывает email под именем (у «Системы» почты нет).

SQL-тесты: `supabase/tests/journal_events.test.sql` (12 сценариев, гонять через psql в контейнере).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/audit-logs.ts` | `list` (фильтры + trgm-поиск), `listForEntity` (история одной сущности, опц. с дочками). Только чтение |
| `api/journal.ts` | `journalApi.list` → RPC `journal_events` (единая лента), маппер snake→camel |
| `composables/useAuditLog.ts` | `list`, `listForEntity`, `enabled` (фиче-флаг). Только чтение — записи из фронта нет |
| `composables/useJournal.ts` | Состояние ленты: keyset `loadInitial`/`loadMore`, снапшот фильтров активного запроса, защита от stale-batch race (поколения `_gen`) |
| `utils/audit-labels.ts` | en→ru: `entityTypeLabel`, `actionMeta`, `fieldLabel`, `renderChanges` (дифф), enum-значения (`ENUM_VALUE_LABELS`), группы фильтра (`ENTITY_TYPE_GROUPS`) |
| `utils/audit-columns.ts` | Фабрика колонок `auditLogColumns()` для UiDataTable: 5 колонок (Дата / Действие / Объект / Изменения / Сотрудник), ячейки рендерятся SFC-примитивами через `h()`. «Действие» приглушённое: цветной маркер с точкой только для created/deleted/restored, «Изменено» — тихий hint-текст без точки |
| `utils/journal-row.ts` | Адаптер `JournalEvent` → `JournalRow` (форма AuditLog + branchBadge + changeSummary) |
| `components/AuditChange.vue` | Одна дельта диффа (`RenderedChange`): все ветки kind (phrase/complex/price/text), line-through на old, цвет направления цены на new. Без обрезки — длинные значения переносятся |
| `components/AuditAction.vue` | Маркер действия: цветная точка (`dot`, default true) + лейбл из `actionMeta`. НЕ тег |
| `components/AuditEntityRef.vue` | Ячейка «Объект»: имя (прочерк если нет) + тип сущности + опц. чип филиала |
| `components/AuditActor.vue` | Ячейка «Сотрудник»: имя + роль + email (hint, live-join из RPC, NULL у удалённых); без актора — приглушённое «Система» без email |
| `components/AuditTrail.vue` | Встраиваемая панель истории сущности (таймлайн в дроверах). Props: `entityType`, `entityId`, `includeChildren`, `refreshKey`. Дельты/действие — через `AuditChange`/`AuditAction`. Импорт deep-path |
| `pages/audit-log.vue` (в `apps/admin/pages`) | Единая лента: фильтры (действие/объект, гейтинг по вертикали+модулям), поиск, период (daterange → `from`/`to`, БЕЗ персиста — протухший период молча прятал бы свежие записи), скоуп по филиалу из сайдбара, infinite-scroll, persistence остальных фильтров в localStorage |

`AuditChange`/`AuditAction`/`AuditEntityRef`/`AuditActor` — общие примитивы для таблицы журнала И таймлайна `AuditTrail`. Стили живут в самих SFC: scoped CSS страницы не достаёт до `h()`-нод внутри DataTable. Разметку дельт/действия НЕ копипастить — только эти компоненты.

## Типовые задачи

- **Добавить аудит новой сущности:** миграция с `CREATE TRIGGER ... EXECUTE FUNCTION fn_audit('<entity_type>', '<name_col>|-|user:<col>', '<parent_spec>')`. Затем добавь лейблы в `audit-labels.ts` (ENTITY_TYPE_LABELS + ENTITY_TYPE_GROUPS + поля) — тест на 1:1 покрытие групп упадёт, если забыть. Если тип видим не всем — гейтинг в `moduleGateByType`/`RETAIL_ONLY`/`SERVICES_ONLY` на странице.
- **Встроить историю в карточку/дровер:** `<AuditTrail entity-type="dish" :entity-id="id" :refresh-key="key" />`. Для родителя с дочками — `:include-children="true" :show-entity="true"`.
- **Новый фильтр на странице:** расширь `AuditLogsListParams` + ветку в `api/audit-logs.list()` + UI.
- **Включён в проде:** флаг `auditLogEnabled` (`shared/utils/featureFlags`). Право чтения — `audit_log.view` (овнер видит всегда; кастомным ролям выдать в правах).

## Антипаттерны

- ❌ Возвращать ручную запись в `audit_logs` из фронта — для триггерных сущностей будет двойная запись. Запись только триггерами.
- ❌ UPDATE/DELETE на `audit_logs` — append-only.
- ❌ Логировать reorder/`sort_order` — намеренно игнорируется в триггере.
- ❌ Тащить заказы/записи в `audit_logs` — у них свои `*_events`.
