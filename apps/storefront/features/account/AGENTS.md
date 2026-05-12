# account — заметка для агента

Личный кабинет гостя storefront. Shared aggregator (показывает и orders/retail, и appointments/services — но сама фича не про booking-flow, только обзор).

## Что модуль делает

`useAddressesStore` хранит сохранённые адреса доставки гостя (читает/мутирует через `/api/customer/addresses`). Используется на странице `/account/addresses` и в `CheckoutAddressSection` (выбрать сохранённый адрес).

Страницы:
- `/account` (index) — сводка: имя гостя + последние заказы + кнопки переходов
- `/account/profile` — форма имя/телефон/email + удалить аккаунт
- `/account/addresses` — CRUD адресов
- `/account/orders` — список заказов с фильтрами + детали по клику
- `/account/appointments` — **живёт в модуле `appointments`** (services), не здесь

## Карта модуля

| Файл | Что внутри |
|---|---|
| `stores/addresses.ts` | `useAddressesStore` — список адресов гостя + CRUD-методы |
| `components/AccountCardsSkeleton.vue` | Skeleton-loader для карточек в кабинете (orders/appointments grid) |
| `components/AddressFormModal.vue` | Модалка добавления/редактирования адреса (улица/дом/квартира/комментарий + dadata-suggestions) |

## Типовые задачи

- **Новое поле адреса:** правится в `Customer*` типах + `AddressFormModal.vue` + serverный `/api/customer/addresses` + миграция БД.
- **Новая страница кабинета (например, `/account/loyalty`):** создай `pages/account/loyalty.vue`, добавь route в manifest, добавь линк в `/account/index.vue` сводке.

## Антипаттерны (не делай так)

- ❌ Прямой `supabase.from('customer_addresses')` — RLS строгая, идёт через `/api/customer/addresses`.
- ❌ Импорт `~/stores/addresses` (старый путь) — через `~/features/account`.
- ❌ Помещать сюда booking-flow или order tracking — отдельные модули. Account = только обзор.

## Куда расти

- **Программа лояльности** (WISHLIST): новая страница `/account/loyalty` + новая таблица `customer_bonuses` + UI с балансом.
- **Базы гостей / CRM в admin** (WISHLIST): касается админки, не этого модуля.
