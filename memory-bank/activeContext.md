# Active Context: Fastio

## Current Work Focus
Совместимость корзины с филиалами (2026-05-03). Tenant-настройка `branch_selection_mode` (`unified` vs `per_branch`), привязка позиций к филиалам через `dish_branches`/`combo_branches`, виджет светофора готовности филиалов в корзине витрины и модалка выбора филиала для per-branch режима. Полный план: `docs/plans/2026-05-03-branch-cart-compatibility.md`.

Параллельный трек — переход с «групп записей» на «визиты» (2026-05-01): визит = посещение клиентом заведения в один бизнес-день, может содержать 1+ услуг с независимыми статусами. Главный принцип: визит живёт независимо от статусов услуг внутри.

## Recent Changes
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
