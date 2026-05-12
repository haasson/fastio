# booking — заметка для агента

Бронь стола в ресторане (retail). Не путать с `appointments` — это онлайн-запись на услуги (services).

## Что модуль делает

3-шаговая форма брони стола: выбор даты/количества гостей/филиала → выбор свободного слота → контакты гостя → submit. Данные идут на Nitro endpoints `/api/reservations/slots` (получить слоты) и `/api/reservations` (создать бронь).

Если гость авторизован — `Authorization: Bearer <token>` подмешивается, бронь линкуется к его аккаунту (`linkedToAccount: true`). Если гость анонимный — бронь без привязки к customer.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `composables/useBooking.ts` | State формы (step/form/slots/loading/error/result) + методы `fetchSlots`, `submit`. Default export. |
| `components/BookingStepParams.vue` | Шаг 1: дата, гости, филиал |
| `components/BookingStepSlots.vue` | Шаг 2: выбор временного слота |
| `components/BookingStepContact.vue` | Шаг 3: имя/телефон/email/комментарий + submit |
| `components/BookingSuccess.vue` | Финальный экран после успешной брони |

## Типовые задачи

- **Добавить поле в форму:** `BookingForm` тип в `useBooking.ts` → `reactive(form)` → UI в `BookingStepContact.vue` → серверный обработчик `apps/storefront/server/api/reservations/index.post.ts`.
- **Изменить логику слотов:** правится в `apps/storefront/server/api/reservations/slots.get.ts` + админская часть (резервации в админке).
- **Авто-заполнение для авторизованных гостей:** в `useBooking.submit()` проверяется session → можно расширить через `customers.getProfile()` если нужно подставить имя/телефон по умолчанию.

## Антипаттерны (не делай так)

- ❌ Прямой `supabase.from('reservations')` или `.insert()` из клиента — RLS не пропустит без service-role; идёт через серверный endpoint, который дополнительно валидирует слот.
- ❌ Импорт `~/features/booking/composables/useBooking` снаружи модуля — используй `import { useBooking } from '~/features/booking'`.
- ❌ Создать второй composable со своим state брони — `useBooking` уже singleton-в-страничном-scope (хотя factory). Если нужен глобальный state — оборачивай через Pinia store.
- ❌ Слать запрос на `/api/reservations` без `branchId` для тенантов с per-branch режимом — бэк подберёт `null` и бронь падёт в общую кучу.

## Куда расти

- Авто-выбор оптимального филиала по гео (если у тенанта несколько). Сейчас селектится через `useSelectedBranchStore`.
- Telegram-напоминание о брони (см. WISHLIST: «Telegram-напоминания клиентам о предстоящей записи» — паттерн тот же).
- Возможность отменить бронь из storefront личного кабинета (сейчас оф нет — только через админку).
