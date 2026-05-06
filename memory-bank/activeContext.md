# Active Context: Fastio

## Current Work Focus
Совместимость корзины с филиалами (2026-05-03). Tenant-настройка `branch_selection_mode` (`unified` vs `per_branch`), привязка позиций к филиалам через `dish_branches`/`combo_branches`, виджет светофора готовности филиалов в корзине витрины и модалка выбора филиала для per-branch режима. Полный план: `docs/plans/2026-05-03-branch-cart-compatibility.md`.

Параллельный трек — переход с «групп записей» на «визиты» (2026-05-01): визит = посещение клиентом заведения в один бизнес-день, может содержать 1+ услуг с независимыми статусами. Главный принцип: визит живёт независимо от статусов услуг внутри.

## Recent Changes
- **Таймлайн v2 + view_own RLS** (2026-05-06, миграция 253):
  - Таймлайн полностью переписан: статическая HTML-таблица → pixel-grid с абсолютным позиционированием карточек, drag&drop переноса записей через RPC `update_appointment` (capacity-check + advisory_xact_lock + audit-events), confirm-модалка перед сохранением. Компоненты вынесены в композаблы `useTimelineLayout` / `useTimelineDrag` / `useScrollToNow` + утилка `buildTimelineAvailability`. Now-линия с авто-скроллом, дим прошлых/off-hours/disabled слотов.
  - Новая роль «Мастер»: ключи `appointments.view_all` / `appointments.view_own` в `tenant_roles.permissions`. View_own видит только свои ресурсы (через `resources.member_id`). Серверное enforcement — RESTRICTIVE SELECT-policy `appointments_view_own_restrict` на `appointments`.
  - Дефолтные роли в миграции 253: Администратор/Менеджер → `view_all=true`, Сотрудник → `view_own=true`. Кастомные не трогаем. Триггер `create_default_roles` обновлён для новых тенантов.
  - View_own редирект через middleware/gate.global: новый GateKey `viewAllAppointments` мапит `/appointments/list` и `/appointments/visits` — мастеру с `view_own` сюда нельзя. `/appointments/timeline` добавлен в REDIRECT_FALLBACKS перед `/appointments` (иначе зацикливание через routeRule).
  - Отдельная страница `/appointments/appointment/[id]` — компактный просмотр ОДНОЙ услуги для view_own (без чужих услуг визита и телефона). Mounted-проверка через лёгкий `api.resources.getMemberId(resourceId)` вместо `list(tid)`.
  - `customerEmail` убран из админ-редактора визита: поле в БД заполняется только когда визит пришёл со storefront. Поле остаётся в БД, в админке не показывается и не редактируется.
  - Кэш `bulkLoadCompetencies` на сессию (module-level Map по sorted-resource-ids). Realtime-fetch таймлайна не дёргает RPC каждые 200мс.
- **Cross-tenant isolation hardening** (2026-05-04):
  - Миграция **245** — убраны клиентские RLS-policies `customers FOR UPDATE` и `customer_addresses FOR ALL` (все мутации идут через server endpoints с service_role; auth.uid()-only без tenant-фильтра позволял PATCH чужой строки в другом тенанте, если у юзера есть customer-строки в нескольких тенантах).
  - Миграция **246** — в RPC `services_set_branch_ids`, `resources_set_branch_ids`, `resources_set_service_ids`, `resources_set_category_ids`, `apply_shift_template_to_resource`, `dishes_set_branch_ids`, `combos_set_branch_ids` добавлен EXISTS-чек что все вторичные uuid принадлежат тому же тенанту что и parent (раньше member тенанта A мог пробросить branch_id тенанта B и записать кросс-тенантную связь). `apply_weekly_template_to_resource` уже валидировал в 216.
  - Storefront fix: `db.raw.from('branches')` без tenant-фильтра в `appointments/group-slots.get.ts:249`, `appointments/slots.get.ts:198`, `appointments/group-week.get.ts:267`, `orders/[id].get.ts:30` — добавлен `.eq('tenant_id', db.tenantId)` (service_role байпасит RLS, чужой `branchId` отдавал расписание/адрес другого тенанта).
  - Storefront fix: `order-items.ts` подгружал combos/dish_modifier_options/dish_addons без tenant-фильтра — добавлены `.eq('tenant_id', tenantId)` для combos/dishes и `!inner` JOIN на parent с фильтром по tenant_id для junction-таблиц. Подсунуть combo чужого тенанта через `comboId` в `/api/orders.post` теперь невозможно.
  - **`db.raw` теперь Proxy:** `db.raw.from(<tenant-таблица>)` автоматически инжектит `.eq('tenant_id', tenantId)`. Список таблиц с tenant_id в `apps/storefront/server/utils/tenantDb.ts → TENANT_TABLES` (синхронизирован с БД через `information_schema.columns`). Если разработчик случайно использует `db.raw.from('branches')` вместо `db.from('branches')` — фильтр теперь срабатывает автоматически. Для умышленных cross-tenant операций (миграции, фоновые задачи) — отдельный `db.crossTenant` без защиты. RPC и channel — pass-through (RPC сами проверяют `is_tenant_member`).
  - Чеклист в `docs/plans/2026-04-29-appointments-v2-deferred.md` пункт 0c обновлён. Осталось: расширить integration-тесты с двумя тенантами на все endpoint'ы.
- **Branch cart compatibility** (2026-05-03):
  - Миграции **239** (`dish_branches` + `combo_branches` junction-таблицы с RLS и публичным read'ом) и **240** (`tenants.branch_selection_mode` default `'unified'`)
  - Admin: в `DishFormDrawer`/`ComboFormDrawer` добавлен мультиселект «Филиалы» (виден если 2+ филиала и включён модуль `branches`); новая секция «Выбор филиала клиентом» в `pages/orders/settings.vue`
  - Storefront unified-режим: подсказка «Доступно не во всех филиалах» на карточках/в модалке блюда (пунктир + тултип), виджет «Готовность филиалов» в корзине (зелёный/жёлтый/красный), сортировка пунктов самовывоза по совместимости, warning'и про доставку если зона привязана к филиалу с пробелами
  - Storefront per_branch-режим: `useSelectedBranchStore` + плагин восстановления из localStorage, `BranchPickerModal` (несдвигаема на первом заходе), pill-кнопка в `SiteHeader`, проброс `?branchId=` в `/api/menu` и `/api/services-catalog`
  - Утилка `apps/storefront/utils/branchCompat.ts` с unit-тестами
- **Визиты вместо групп записей** (2026-05-01, миграции 224-232):
- **Визиты вместо групп записей** (2026-05-01, миграции 224-232):
  - 224: `compute_business_date(branch, tenant, ts)` — порт логики overnight из `workingHours.ts:isOpenNow` на SQL. `appointment_groups.business_date NOT NULL` + триггер инварианта на appointments. Откат «inbox-коробки» из 222/223. Бэкфилл standalone-appointments через `COALESCE(customer_id, customer_phone)` ключ (customer_id приоритетен — телефон может меняться). Удаление пустых зомби-визитов до `SET NOT NULL`.
  - 225: `add_service_to_visit` (синоним `add_appointment_to_group`). `move_appointment` — атомарный перенос: same-day reschedule, cross-day создаёт/находит целевой визит и чистит опустевший старый.
  - 226: `merge_visits` и колонка `merged_into_id` снесены — кейс «случайно создал второй визит» закрывается через `move_appointment`.
  - 230: `appointment_requests` объединены с визитами — заявка теперь визит со `status='request'` и `business_date IS NULL`.
  - 231: `split_visit_to_request` — вынос услуг в новый request-визит. После 232 использует soft-delete вместо UPDATE status='cancelled'.
  - 232: **soft-delete на appointments** (`deleted_at`/`deleted_by`/`deleted_reason`). Per-service удаление в редакторе теперь физически удаляет запись (скрыто из UI, остаётся для аудита), отдельно от бизнес-`cancelled` визита. Новые RPC: `move_visit_to_date` (атомарный перенос целого визита), `count_pending_visits` (бейдж «Новые»). Триггер `log_visit_cancelled` пишет audit events. Дроп обёртки `add_appointment_to_group`. Фильтр `status='active'` в `move_appointment` для target-визита, RAISE в `add_service_to_visit` для не-active. См. ADR в `systemPatterns.md` («Визит — независимая коробка»).
  - Фронт админки полностью переименован TS-слой `appointmentGroups → visits` (БД-таблица не трогалась). Новый composable `useVisitAggregate` (предикаты страницы визита). UI-агрегат включает `'done'` для архива всех завершённых услуг. `slotChanged` через computed-сравнение `original*` vs `current*`. `useDebounceFn` 300мс на realtime burst в инбоксе. ServiceCard через `<UiCard>` без БЭМ. Pure-функции `computeSlotTone`/`groupSlotsByHour` в `@fastio/shared` устраняют дубль admin/storefront.
  - Bug-фиксы: завершённые визиты теперь в архиве (раньше выпадали из всех вкладок). Кнопка «Принять» показывается только для pending-агрегата (раньше торчала и на confirmed/done).
  - Витрина: `bulk.post.ts` возвращает `visitId` (готовность под будущий ЛК), нейтральное сообщение при P0002 («Время уже занято, выберите другое»). Одиночный POST `/api/appointments` снесён.
- **Telegram auth для storefront** (2026-04-25): добавлен Telegram Login Widget. Sliding-session модель (HttpOnly cookie, SHA-256 хеш токена в БД, продление TTL при использовании, pg_cron cleanup). Решение и обоснование выбора A vs B — в `systemPatterns.md` → ADR.
- **Route-level гейтинг** (2026-04-25): добавлен `middleware/gate.global.ts` + `composables/plan/useGate.routes.ts`. Закрывает прямой URL-доступ к секциям, которых юзер не видит в `AppNav` (выключенный модуль, нет прав, locked план). Карта роут → `GateKey` совпадает с видимостью в навигации. Suspended-флоу остаётся за `auth.global` (избегаем двойного редиректа). При отказе ищет первый доступный fallback из `REDIRECT_FALLBACKS` (`/`, `/orders`, …, `/account/profile`).
- **`useGate` система** (2026-04-25): новый composable `composables/plan/useGate.ts` с типами в `useGate.types.ts`, тесты в `__tests__/useGate.test.ts` (27 кейсов). Заменяет ручное комбинирование `usePermissions + useAccess + tenant.modules + tenant config`. Каждый гейт возвращает `{enabled, reason, requiredPlan?, configPath?, hint?}`. Приоритет причин: suspended → absent → flag → locked → disabled → unconfigured → forbidden. `useAccess.ts` удалён (не было ни одного потребителя).
- Хелпер `useGate.helpers.ts` — `toEnabled()` для конвертации в boolean
- Мигрированы: AppNav, orders/*, kitchen/*, menu/*, tables/*, reservations/settings, team, audit-log, settings/notifications, BannerFormModal, useBranchLimit, useKitchenStatusBlock
- Добавлен `apps/help/` — Nuxt SSR приложение (порт 4712)
- Добавлен `packages/kb/` — пакет с markdown-контентом и структурой KB
- В `apps/admin/server/ai/loadKnowledge.ts` — логика загрузки контента для AI-ассистента
- PhotoSwipe lightbox в gallery slider (storefront)
- Пиннинг categoryBar и hero в sections editor

## Next Steps
- Уточнить у пользователя текущий статус help-приложения
- Обновить этот файл после прояснения задач

## Active Decisions and Considerations
- `@fastio/kb` — единый источник правды для контента KB: используется и в help-приложении (рендер страниц), и в admin (AI-ассистент загружает kb-файлы через `loadKnowledge`)
- KB_ROUTES в `packages/kb/src/index.ts` маппит роуты admin → секции AI-знаний

## Important Patterns and Preferences
- Пользователь предпочитает неформальное общение, юмор, конкретику
- Всегда читать исходники компонентов @fastio/ui перед использованием
- Перед коммитом — обновлять KB-файлы в `packages/kb/content/*.md`
