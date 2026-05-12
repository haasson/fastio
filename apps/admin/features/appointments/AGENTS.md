# appointments — заметка для агента

Онлайн-запись (services). Самая большая фича в проекте — таймлайн, инбокс, шаблоны расписаний, мутации через RPC. Полная мета — `feature.manifest.ts`.

## Что модуль делает

`appointment` — слот в расписании исполнителя на услугу. `visit` — синтетическая единица, объединяющая несколько связанных appointments одного гостя (групповая запись). Inbox принимает заявки от storefront, менеджер подтверждает/правит/двигает. Шаблоны расписаний раскатываются по resource'ам через RPC.

**Все мутации идут через RPC**, не через прямые INSERT/UPDATE — это критично (RPC валидирует слоты, конфликты, лимиты и пишет audit в `appointment_events` атомарно).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/appointments.ts` | CRUD-обёртки над RPC (`create_appointment`, `update_appointment`, `move_appointment`, ...) |
| `api/appointment-events.ts` | Чтение audit-log конкретной записи (write — через RPC) |
| `api/appointment-settings.ts` | Get/upsert настроек слотов, буферов, лимитов |
| `api/visits.ts` | Композитные операции над визитами (split/convert/add-service) |
| `api/resources.ts` | Исполнители + их компетенции/филиалы/категории (через RPC `resources_set_*_ids`) |
| `api/resource-unavailability.ts` | Точечные «недоступен с/до» (отпуска/больничные) |
| `api/schedule-templates.ts` | CRUD шаблонов + RPC раскатки (`apply_shift_template_to_resource`) |
| `composables/useAppointmentsChannel.ts` | **Глобальный realtime-канал. Один раз в layout.** |
| `composables/useVisitsChannel.ts` | Канал для inbox (визиты в статусе request) |
| `composables/useAppointmentEditorState.ts` | State редактора одной записи (drawer/modal) |
| `composables/useScheduleConflictCheck.ts` | Проверка конфликта слота **на фронте** (быстрый ответ; финальную проверку делает RPC) |
| `composables/useTimelineMoveBlocker.ts` | Блокировка drag-n-drop на таймлайне когда нельзя |
| `composables/useResourcePresence.ts` | Кто сейчас «онлайн» (для таймлайн-индикатора) |
| `composables/useGroupSlotSearch.ts` | Поиск общих слотов для группы исполнителей |
| `composables/useAppointmentEvents.ts` | Realtime-фид событий записи (audit-лента) |
| `composables/useAppointmentInboxHandler.ts` | Звук+toast на новую заявку в inbox |
| `composables/useStaffMonthSchedule.ts` | Календарь месяца для расписаний staff'а |
| `composables/useVisitAggregate.ts` | Сборка визита из appointments + сервисов |
| `composables/useVisitsList.ts` | Inbox-список визитов с фильтрами |
| `composables/useInboxTableColumns.ts` | Колонки таблицы inbox |
| `composables/useAppointmentEventLogger.ts` | Запись audit-события (используется внутри API) |
| `composables/useAppointmentInboxCounter.ts`, `useAppointmentInboxHandler.ts` | Бейдж/звук на новую заявку |
| `composables/useAppointmentViewScope.ts` | Определяет `view_all` vs `view_own` по permission'у |
| `composables/useEditorCompetencies.ts` | Выбор исполнителя по компетенциям услуги |
| `utils/scheduleConflictCheck.ts` | Чистая функция конфликта (без обращений к API) |
| `utils/timelineAvailability.ts` | Расчёт доступных слотов из расписания + блокеров |
| `stores/appointmentSettings.ts` | Глобальный стор настроек модуля |
| `components/timeline/` | **Внутренняя подпапка.** Через barrel не ре-экспортится |
| `components/appointmentEditor/` | **Внутренняя подпапка.** Через barrel не ре-экспортится |

## Типовые задачи

- **Новый RPC-метод:** SQL-функция в миграции → обёртка в `api/appointments.ts` или `api/visits.ts` → composable если нужен state.
- **Изменить логику конфликтов:** правь и `utils/scheduleConflictCheck.ts` (фронт), и RPC (`create_appointment`/`update_appointment`) — иначе фронт и БД разойдутся. Тесты в `__tests__/utils/`.
- **Расширить статусы визита:** enum в БД + `Visit` тип в `@fastio/shared` + `mapAppointment`/`mapVisit` + UI цвета.
- **Запись из storefront:** там вызывается `rpc('public_create_appointment_request')` — это **отдельный** RPC, проверяющий капчу и лимиты. Не путать с админским `create_appointment`.

## Антипаттерны (не делай так)

- ❌ Прямой `INSERT INTO appointments` через `sb.from('appointments').insert()` — обходит валидацию слотов и не пишет audit. **Только через RPC `create_appointment`/`create_appointments_bulk`**.
- ❌ Прямой `UPDATE` для смены времени — `move_appointment` RPC проверяет конфликты и логирует. См. TECHDEBT.md: в `update_appointment` есть inline-комментарий, который ещё не реализован полностью.
- ❌ Создавать ещё один realtime-канал на `appointments` — каналы уже глобальные.
- ❌ Дёргать `services-catalog/api/...` deep-path — только через `useDatabase().services` или barrel.
- ❌ Класть логику слотов в компоненты — она в `utils/timelineAvailability.ts`.
- ❌ Игнорить `useAppointmentViewScope` — он различает `view_all` (менеджер) и `view_own` (мастер видит только свой таймлайн).

## Куда расти

Биллинг визитов (предоплата/депозит) — отдельная фича (пока в `billing`). Логика стоимости услуги — в `services-catalog`, не сюда.
