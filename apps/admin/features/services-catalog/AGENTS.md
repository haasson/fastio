# services-catalog — заметка для агента

Каталог услуг (services). Аналог `menu` в retail — категории, услуги, теги. Полная мета — `feature.manifest.ts`.

## Что модуль делает

CRUD услуг с привязкой к филиалам (`service_branches`). Связь «какие услуги выполняет исполнитель» живёт в `appointments/api/resources` через `service_resources` (writes идут оттуда, не отсюда).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/services.ts` | CRUD услуг + reorder + привязка к филиалам |
| `composables/useServices.ts` | Realtime-список услуг |
| `composables/useServiceSlots.ts` | Утилитарный composable: расчёт доступных слотов для услуги (использует `appointments/utils/timelineAvailability`) |
| `components/*` | **Cross-module API.** Используются `appointments` и `dashboard`. Импорт deep-path `~/features/services-catalog/components/<X>.vue` |

## Типовые задачи

- **Новое поле услуги:** миграция + тип `Service` в `@fastio/shared` + `mapService` + поле в `api/services.ts`.
- **Расписание услуги:** не тут — это `appointments` (slot logic) и `resources` (кто выполняет).
- **Привязать услугу к филиалу:** `api/services.setBranches(serviceId, branchIds[])` — атомарно через RPC.

## Антипаттерны (не делай так)

- ❌ Писать в `service_resources` отсюда — это домен `appointments` (resources_set_service_ids RPC).
- ❌ Дублировать ценник в `services` и `appointments.price_snapshot` — снапшот в записи берётся из услуги на момент создания, обновление цены услуги его НЕ меняет (by design).
- ❌ Дёргать `appointments/api/...` снаружи через deep-path — только через `useDatabase().appointments` или barrel.

## Куда расти

Сложная стоимость (зависит от исполнителя/времени) — пока не поддерживается, понадобится — отдельная таблица `service_pricing_rules`, не лепи в `services`.
