# promotions — заметка для агента

Акции и промокоды (retail, toggleable `promotions`). Полная мета — `feature.manifest.ts`.

## Что модуль делает

Описание правил скидок: на корзину, на конкретное блюдо, на категорию, с условием минимального чека. Промокоды — отдельная сущность с лимитами использования и сроком жизни. Применение → в `features/orders/composables/useOrderPromo`.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/promotions.ts` | CRUD акций + проверка пересечений |
| `api/promo-codes.ts` | CRUD промокодов + bulk-генерация |
| `composables/usePromotions.ts` | Realtime-список акций |
| `composables/usePromoCodes.ts` | Realtime-список промокодов |
| `utils/promoStatus.ts` | Чистая функция: статус акции (active/scheduled/expired) по датам |
| `columns/promotions.ts`, `columns/promo-codes.ts` | Колонки таблиц (cross-module — реэкспортятся через barrel) |
| `columns/_shared.ts` | **Внутренние билдеры.** Префикс `_` → через barrel не реэкспортятся |

## Типовые задачи

- **Новый тип акции:** добавь дискриминант в `Promotion` (в `@fastio/shared`), расширь `mapPromotion`, добавь поле в форму, и **обязательно** в `useOrderPromo.apply()` — без этого акция не применится к заказу.
- **Связать с блюдами:** `Promotion.dishIds[]` — массив, валидация что блюда существуют в `api/promotions.create/update`.
- **Промокод с одноразовым использованием:** `PromoCode.maxUses=1` + проверка `useOrderPromo.validate()`. Атомарность гарантирует БД (unique index на использования).

## Антипаттерны (не делай так)

- ❌ Применять скидку **в этой фиче** — она только описывает правила. Применение — `features/orders` (`useOrderPromo`).
- ❌ Дёргать `features/menu/api/dishes` для проверки существования блюда — используй cached список из `useDatabase().dishes` (он уже подгружен).
- ❌ Класть логику расчёта скидки в компонент — она в `@fastio/shared/utils/promo-apply` (или должна быть; перепроверь, не дублируй).
- ❌ Создавать второй realtime канал — `usePromotions`/`usePromoCodes` уже на `useRealtimeList`.

## Куда расти

A/B-тесты акций (несколько вариантов на одну ЦА) — не сюда, отдельная фича `experiments`.
