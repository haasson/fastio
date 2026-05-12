# billing — заметка для агента

Биллинг кабинет тенанта (shared). Полная мета — `feature.manifest.ts`.

## Что модуль делает

CRUD-обёртки над `plans` / `billing_config` / `billing_transactions` + UI кабинета. **Сами гейты по плану** (`useGate`, `useGate.retail`, `useGate.shared`) живут в `shared/plan/` — это by design: гейты используются ВЕЗДЕ, не только в кабинете биллинга, поэтому они в shared.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/billing.ts` | `billingApi`: текущий config, history транзакций, инициация апгрейда |
| `api/plans.ts` | `plansApi`: список планов с feature-флагами |
| `components/*` | UI кабинета: `BillingSummary`, `PlanCards`, `TransactionHistory`. Импорт deep-path в `pages/account/billing.vue` |

## Типовые задачи

- **Новый тариф:** новая строка в `plans` через миграцию + расширь `PlanFeatures`-тип в `@fastio/shared` + обнови UI карточек.
- **Новый feature-флаг плана:** добавь поле в `PlanFeatures`, поддержку в `useResolvedFeatures` (`shared/plan/`), потом UI признака в `PlanCards`. **Гейтинг (`useGate`)** — в shared/plan, не сюда.
- **Webhook от платёжного провайдера:** Edge Function `supabase/functions/payment-webhook` — она пишет в `billing_transactions`. Эта фича только читает.

## Антипаттерны (не делай так)

- ❌ Класть `useGate`/`usePlans` сюда — они в `shared/plan/`, потому что используются всеми модулями (включая `AppNav` для блокировки пунктов меню).
- ❌ Писать в `billing_transactions` из фронта — это write-only из webhook + RLS-защита.
- ❌ Хардкодить порядок планов — `plans.sort_order` есть в БД.

## Куда расти

Promo-коды на план (купоны для триала) — не сюда, у webhook'а есть валидатор. Расширяй там.
