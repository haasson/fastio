# reservations — заметка для агента

Бронирования столов (retail). **Часть модуля «Столы» (dineIn)** — собственного тоггла и собственных страниц нет. UI живёт под `pages/tables/`: вкладка «Бронирование» (`/tables/reservations`) и блок «Бронирование» в `/tables/settings`. Это фича-библиотека: api/composables/store/components, которые потребляют страницы столов. Полная мета — в `feature.manifest.ts` рядом.

`modules.reservations` — под-флаг «онлайн-брони вкл/выкл» (его читает витрина), управляется мастер-свитчем в `pages/tables/settings.vue`, НЕ из каталога модулей.

## Что модуль делает

Все брони в одной таблице (`/tables/reservations`, server-пагинация, фильтр по статусу) + realtime, настройки слотов/буфера/лимитов в `/tables/settings`. Поток статусов: `pending → confirmed → seated → completed` (или `cancelled` на любом этапе).

## Карта модуля

| Папка | Что внутри |
|---|---|
| `api/reservations.ts` | CRUD + переходы статусов (`confirm`, `cancel`, `seat`, `complete`) + `listPaginated` |
| `api/reservation-settings.ts` | get/upsert настроек слотов и лимитов |
| `composables/useReservations.ts` | Главное состояние + локальные обработчики realtime |
| `composables/useReservationsChannel.ts` | **Создаёт канал. Вызывать РОВНО ОДИН раз в layout.** Эмитит `reservationEvents` |
| `composables/useReservationTable.ts` | n-data-table glue: колонки, пагинация, фильтры |
| `composables/useReservationAlertHandler.ts` | Звук+toast при новой брони |
| `composables/useNewReservationCounter.ts` | Бейдж непросмотренных |
| `stores/reservations.ts` | Pinia-обёртка над `useReservations` — глобальное состояние |
| `components/ReservationDrawer.vue` | Просмотр/редактирование одной брони |
| `components/ReservationTablePicker.vue` | Выбор стола при подтверждении |
| `utils/reservation-constants.ts` | `RESERVATION_ACTIVE_STATUSES` и т.п. |
| `utils/columns.ts` | **Внутреннее** — не реэкспортится через barrel |

## Типовые задачи

- **Новое поле в брони:**
  1. Добавь колонку в миграцию + `Reservation` тип в `packages/shared/src/types/reservation.ts`
  2. Расширь `mapReservation` (он в `@fastio/shared`, не локальный!)
  3. Добавь поле в `SELECT_FIELDS` и `update`/`create` в `api/reservations.ts`
  4. Расширь `Drawer` и `columns.ts` если нужен UI

- **Новый переход статуса:** добавь метод в `reservationsApi` (паттерн как `seat`/`complete`), потом обёртку в `useReservations`, потом кнопку в `Drawer`.

- **Новая страница раздела:** клади в `apps/admin/pages/tables/` (брони — часть модуля «Столы»), **НЕ** в `features/reservations/components/`. Не забудь объявить роут в `features/tables/feature.manifest.ts`.

## Антипаттерны (не делай так)

- ❌ Создавать ещё один канал на `reservations` — он уже глобальный (`useReservationsChannel` + `reservationEvents`). Подписывайся на события, а не на realtime напрямую.
- ❌ Импортировать из `features/reservations/api/...` снаружи модуля — только через `useDatabase().reservations` или barrel.
- ❌ Дублировать `mapReservation` — он живёт в `@fastio/shared`, тут только реэкспорт.
- ❌ Класть утилки времени/слотов сюда — это в `@fastio/shared` (scheduling/timeRange).
- ❌ Cross-feature импорты в `tables/`/`branches/` — только через их `index.ts` (barrel).

## Куда расти

Если добавляешь функцию, которая нужна и `appointments`, и `reservations` (например, общая логика слотов) — выноси в `@fastio/shared` или в `shared/data/`, **не** копируй между фичами.
