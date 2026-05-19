# appointments — заметка для агента

Онлайн-запись (services-vertical). Самая большая фича в admin: таймлайн, инбокс визитов, исполнители (resources), объекты, шаблоны расписаний, audit-события. Полная мета — `feature.manifest.ts`.

## Что модуль делает

`appointment` — слот в расписании ресурса (исполнитель/объект) на одну услугу. `appointment_group` (UI-термин — **visit**) — контейнер визита: несколько связанных appointments одного гостя (мульти-услуга/группа).

Visit имеет статус `request` (заявка с витрины ещё не оформлена) / `active` (визит создан) / `cancelled`. Отдельной таблицы `appointment_requests` больше **нет** — заявка = `appointment_groups.status='request'` + список услуг в `requested_services` JSONB.

Все «опасные» мутации (создание, перенос, изменение слота, конверсия заявки) идут **через RPC** SECURITY DEFINER — там advisory-lock, capacity-чек, snapshot полей услуги, и атомарная запись в `appointment_events` (audit). Прямые INSERT/UPDATE в `appointments` — только для status/cancel/soft-delete/done и метаданных группы (`visits.updateMeta`).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/appointments.ts` | CRUD одной appointment: `create`/`update`/`reschedule`/`move`/`addToVisit`/`confirm`/`cancel`/`softDelete`/`markDone`. create/reschedule/move/addToVisit — через RPC. `update` — прямой UPDATE для статусов/метаданных. `listForDay` / `listPaginated` / `countActiveFuture`. |
| `api/visits.ts` | Композитные операции над визитом: `list` (инбокс), `loadVisitViewData` (визит + appointments + resources + events одной пачкой), `batchLoadAppointmentDetails` (агрегаты для списка), `createBulk` (RPC `create_appointments_bulk`), `convertRequest` (RPC), `moveVisitToDate` (RPC), `splitToRequest` (RPC), `confirm`/`cancelAll`/`declineRequest`/`updateMeta`, `countNew` (бейдж инбокса). |
| `api/appointment-events.ts` | Чтение audit-журнала (`list`) + ручной `add` (используется логером, не вместо RPC). |
| `api/appointment-settings.ts` | Get/upsert настроек слотов, лимитов, режима ресурса (`resource_mode`). |
| `api/resources.ts` | Ресурсы + расписания, override-даты, disabled-слоты, branch/category/service-привязки. Bulk-загрузчики `bulkLoadAvailability` / `bulkLoadPresence` / `bulkLoadCompetencies` — для таймлайна, presence-плашек, редактора. |
| `api/resource-unavailability.ts` | Точечные «недоступен с/до» (отпуск/больничный/обучение). |
| `api/schedule-templates.ts` | CRUD шаблонов + раскатка на ресурс (`applyWeeklyToResource` / `applyShiftToResource` — RPC). |
| `composables/useAppointmentsChannel.ts` | Глобальная Realtime-шина `appointments` (через `createRealtimeBus`). Монтируется один раз в `shared/composables/useRealtimeChannels.ts`. |
| `composables/useVisitsChannel.ts` | То же для `appointment_groups`. |
| `composables/useAppointmentEvents.ts` | Realtime-список событий одного appointment (audit-лента в дравере). |
| `composables/useAppointmentInboxCounter.ts` | Module-level `count` бейджа инбокса. Сеттит только handler. |
| `composables/useAppointmentInboxHandler.ts` | Подписан на `visitsBus`, debounced пересчёт `countNew` при изменениях; монтируется в `useRealtimeChannels.ts`. **Без звука/toast** — это чистый рефреш счётчика. |
| `composables/useAppointmentViewScope.ts` | UI-фильтр `view_all` vs `view_own` (мастер видит только свои ресурсы). **Клиентский** — RLS-enforce ещё не сделан (см. TECHDEBT). |
| `composables/useAppointmentEditorState.ts` | Главный state-композит редактора визита (mode/preset/services/lookups). Делегирует save/snapshot/slot-apply подмодулям в `appointmentEditor/`. |
| `composables/useAppointmentEventLogger.ts` | Сравнивает FormSnapshot с appointment, пишет дельту в `appointment_events`. |
| `composables/useScheduleConflictCheck.ts` | Загружает активные записи на N=180 дней и проверяет, **попадут ли существующие записи в новое расписание** (при редактировании шаблона/смене графика ресурса). Без мутаций. |
| `composables/useGroupSlotSearch.ts` | Admin-аналог storefront `/api/appointments/group-slots`: подбор общих слотов для группы услуг через shared `findGroupSlotsWithFallback`. |
| `composables/useTimelineMoveBlocker.ts` | Pre-flight валидатор drag&drop переноса записи на таймлайне (прошлое / выходной / out-of-hours / disabled / overnight / competency). |
| `composables/useResourcePresence.ts` | Статус `working`/`off-hours`/`absent`/`hidden` для плашек на списках staff/objects. |
| `composables/useStaffMonthSchedule.ts` | Календарь месяца для отдельного мастера (StaffScheduleModal). |
| `composables/useInboxTableColumns.ts` | Колонки UiDataTable для инбокса. |
| `composables/useEditorCompetencies.ts` | Module-cache `bulkLoadCompetencies`; используется редактором + таймлайном. Чистка — `clearCompetenciesCache()`. |
| `composables/useVisitsList.ts` | Списки инбокса с фильтрами/пагинацией + клиентский расчёт `VisitAggregateStatus`. |
| `composables/useVisitAggregate.ts` | Тот же агрегат, но над живым массивом appointments одного визита (для страницы визита). |
| `composables/appointmentEditor/` | Подмодули `useAppointmentEditorState`: `useEditorSave`, `useEditorSnapshot`, `useEditorSlotApply`, `utils.ts`. **Внутренняя подпапка — не ре-экспортится через barrel.** |
| `composables/timeline/` | Подмодули `AppointmentTimelineGrid`: `useTimelineLayout` (грид), `useTimelineDrag` (drag&drop), `useScrollToNow`. **Внутренняя подпапка — не ре-экспортится.** |
| `utils/scheduleConflictCheck.ts` | Чистая функция: попадают ли appointments в slotData. Без обращений к API. |
| `utils/timelineAvailability.ts` | Из `AvailabilityBundle` строит per-resource `{workingHours, disabledSlots, absenceInfo}` на дату. |
| `stores/appointmentSettings.ts` | Глобальный Pinia store настроек модуля (load/refresh). |
| `components/*.vue` | Все компоненты плоско (драверы, модалки, секции, timeline grid). `components/types.ts` — типы редактора (EditorState/EditorService/EditorSnapshot). |

## Типовые задачи

- **Новый RPC-метод:** SQL-функция в миграции → обёртка в `api/appointments.ts` или `api/visits.ts` → composable если нужен state. Маппер для RPC-ответа (`group_id`→`visitId`) держим на клиенте, БД отдаёт snake_case.
- **Изменить логику конфликтов слота:** правь и shared-функцию (`findGroupSlotsWithFallback` в `@fastio/shared`), и RPC (`create_appointments_bulk`/`update_appointment`/`move_appointment`) — иначе фронт и БД разойдутся, RPC откатит транзакцию и юзер получит непонятную ошибку. Тесты — в `__tests__/`.
- **Расширить статусы:** для **appointment** — enum `appointment_status` в БД + `mapAppointment` + UI цвета/лейблы в `@fastio/shared`. Для **visit** — enum `appointment_group_status` + `mapVisit` + `aggregateFromVisit` в `useVisitsList.ts`.
- **Новая операция над визитом:** добавляй в `api/visits.ts` (а не в `appointments.ts`). API визита — точка концентрации composite-операций.
- **Storefront-витрина:** заявки приходят с витрины не через RPC напрямую, а через серверные endpoints `apps/storefront/server/api/appointments/{request,bulk}.post.ts` (capcha + rate-limit + idempotency). Они уже зовут RPC `create_visit_request` / `create_appointments_bulk` через service-role.

## Антипаттерны (не делай так)

- Прямой `INSERT INTO appointments` через `sb.from('appointments').insert()` — обходит advisory-lock, capacity-чек, snapshot полей услуги, audit. Только через RPC (`create_appointment`/`create_appointments_bulk`/`add_service_to_visit`/`convert_visit_request`).
- Прямой `UPDATE` для смены слота/ресурса/услуги. `update_appointment` или `move_appointment` (если меняется дата визита) — там lock + конфликт-чек.
- Создавать ещё один realtime-канал на `appointments`/`appointment_groups`. Каналы глобальные (`appointmentBus`/`visitsBus`), монтируются один раз в `shared/composables/useRealtimeChannels.ts`.
- Дёргать `~/features/services-catalog/api/...` deep-path — только через `useDatabase().services` или barrel `~/features/services-catalog`.
- Класть логику слотов/доступности/конфликтов в `.vue` — она в `utils/timelineAvailability.ts` (для таймлайна), `utils/scheduleConflictCheck.ts` (для пред-проверки шаблона), shared `@fastio/shared/findGroupSlotsWithFallback` (для подбора).
- Игнорить `useAppointmentViewScope` в списках/таймлайне — он различает менеджера (`view_all`) и мастера (`view_own`). Серверного RLS-фильтра ещё нет: без UI-фильтра мастер увидит чужие записи.
- Re-fetch `appointmentSettings` в каждом компоненте — используй `useAppointmentSettingsStore()` (load кэширует по tenantId).

## Куда расти

- **RLS view_own** — приоритет 1 после выкатки роли мастера в реальных тенантах. Сейчас фильтр клиентский.
- **Биллинг визита** (предоплата/депозит) — отдельная фича `billing`, не сюда.
- **Стоимость услуги** (price overrides, акции) — в `services-catalog`, не сюда.
