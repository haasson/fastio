# services-catalog — заметка для агента

Каталог услуг для services-tenant'ов (барбершопы, салоны, студии). Не путать с `menu-catalog` (блюда). Не путать с `appointments` (booking-flow + кабинет записей).

## Что модуль делает

Хранит услуги тенанта (`ServiceCard[]`) в Pinia-сторе + их категории + ресурсы (исполнители). `ServiceCard` — обогащённая структура с информацией для гостя (duration, price, описание, есть ли available resources в выбранном филиале). Источник — `/api/services`.

Секция `ServicesSection.vue` рендерится в `pages/index.vue` под services-tenant'ом (вместо `MenuSection`). Открывает `ServiceModalBody.vue` — модалку с детальной инфой об услуге + кнопкой «Записаться» (которая ведёт во flow модуля `appointments`).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `stores/services.ts` | `useServicesStore` — каталог услуг + computed lookups |
| `composables/useResourceLabel.ts` | Хелпер: «Любой мастер» / `resource.name` для UI |
| `components/ServicesSection.vue` | Секция витрины: сетка ServiceCard'ов по категориям. Mirror of `MenuSection.vue` для retail. |
| `components/ServiceModalBody.vue` | Модалка детали услуги: описание, цена, длительность, доступные мастера, кнопка «Записаться» |

## Типовые задачи

- **Новое поле услуги:** миграция → тип `Service` в `packages/shared` → серверный обработчик `/api/services` → `useServicesStore` (если computed) → UI в `ServicesSection`/`ServiceModalBody`.
- **Новая логика «доступные мастера»:** правь `ServiceCard.availableResources` на бэке + `useResourceLabel`.

## Антипаттерны (не делай так)

- ❌ Прямой `supabase.from('services')` — RLS не пропустит, идёт через `/api/services`.
- ❌ Импорт `~/features/services-catalog/stores/services` снаружи модуля — через `~/features/services-catalog` (barrel).
- ❌ Положить booking-flow сюда — он в `~/features/appointments` (это разделение каталог ↔ запись).
- ❌ Дублировать каталог в `appointments` — модуль `appointments` использует `useServicesStore` для lookup.

## Куда расти

- **Режим услуг без фото** (WISHLIST): добавится `siteLayout.sections.menu.showPhotos: boolean`, читается в `ServicesSection.vue`.
- **Прокат / Rental mode** (WISHLIST): `Resource.rentalMode + poolSize` — нужны расширения типа `ServiceCard` и логика выбора периода в модалке.
- **База гостей / Лояльность**: касается checkout, не каталога. Сюда не лезет.
