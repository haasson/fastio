# appointments — заметка для агента

Booking-flow на услуги + кабинет записей гостя (services vertical). Не путать с `booking` (бронь стола в ресторане — это retail).

## Что модуль делает

**Booking-flow** (на витрине):
1. Гость выбирает услугу/группу услуг (из `services-catalog`) → добавляются в `cart` (`ServiceCartItem`).
2. На `/appointments/cart` — обзор выбранных услуг + кнопка «Дальше».
3. На `/appointments/checkout` — выбор даты (`ApptGroupDateStep`) → слотов (`ApptGroupSlots`) → контакты (`ApptStepContact`) → submit (`ApptGroupRequest`) → успех (`ApptGroupSuccess`).
4. POST `/api/appointments/request` или `/api/appointments/bulk` (multi-service) → создание визита в БД через RPC `public_create_appointment_request`.
5. (Опционально) предложение напоминания в Telegram (`ApptReminderOffer`).

**Кабинет** (`/account/appointments`):
- Список записей гостя (через `/api/customer/appointments`)
- `ApptStatusBadge` — бейдж статуса (request → confirmed → in_progress → done/cancelled)
- Кнопка «Отменить» (POST `/api/customer/appointments/[id]/cancel`)

## Карта модуля

| Файл | Что внутри |
|---|---|
| `components/ApptGroupDateStep.vue` | Шаг 1: выбор даты (календарь + week-overview доступности) |
| `components/ApptGroupSlots.vue` | Шаг 2: выбор временного слота для всей группы услуг |
| `components/ApptStepContact.vue` | Шаг 3: имя/телефон/email/комментарий |
| `components/ApptGroupRequest.vue` | Submit-блок: показ финального экранчика «отправляем» |
| `components/ApptGroupSuccess.vue` | Успешная запись: показ деталей + предложение напоминания |
| `components/ApptReminderOffer.vue` | Опт-ин блок «напомнить в Telegram» (deep-link на бота) |
| `components/ApptStatusBadge.vue` | UI-бейдж статуса визита (используется и в booking-flow и в кабинете) |

## Типовые задачи

- **Изменить логику слотов:** правится в Nitro endpoint `/api/appointments/group-slots`. На клиенте только UI.
- **Новое поле в форме записи:** добавь в `ApptStepContact` + `cart` (`ServiceCartItem`) + endpoint.
- **Новый статус визита:** enum в БД + `AppointmentStatus` в `@fastio/shared` + цвет в `ApptStatusBadge`.

## Антипаттерны (не делай так)

- ❌ Прямой `supabase.rpc('public_create_appointment_request')` — есть `/api/appointments/request` обёртка, она ещё и captcha проверяет.
- ❌ Импорт компонентов из `~/components/appointments/` — старый путь, миграция перенесла их в `~/features/appointments/components/`.
- ❌ Хранить состояние booking-flow в `useCartStore` — там только сами `ServiceCartItem`. Локальный flow-state живёт в `pages/appointments/checkout.vue` (или вынесем в `useAppointmentsCheckout` composable если усложнится).

## Куда расти

- **Telegram-напоминания о записи** (WISHLIST): новая таблица `appointment_reminders` + extension `auth-webhook` + cron edge function. `ApptReminderOffer` уже задел.
- **Branch-awareness** (WISHLIST/design-doc 2026-05-06): глобальный селектор филиала фильтрует доступные услуги/мастеров. Сейчас filter работает только на чекауте.
- **Прокат услуг** (WISHLIST): новый flow «выбрать период» вместо «выбрать слот» — переключение через `Service.rentalMode`.
