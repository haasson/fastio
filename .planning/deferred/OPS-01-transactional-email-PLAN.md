---
requirement: OPS-01
deferred_from_phase: 05-operational-features
deferred_date: 2026-05-23
decision_ref: D-01 (05-CONTEXT.md)
blocker: customer_email field at checkout
---

> **DEFERRED 2026-05-23:** OPS-01 (транзакционный email) перенесён в backlog. Причина (D-01 в `.planning/phases/05-operational-features/05-CONTEXT.md`): поле `customer_email` не собирается при оформлении заказа, отправить письмо-подтверждение некуда. Реализация невозможна без отдельной задачи по checkout. Готовая спека — ниже.

# OPS-01 — Транзакционный email (DEFERRED)

## Original Requirement

- [ ] **OPS-01**: Транзакционный email — клиент получает подтверждение заказа по email (Resend + Edge Function), письмо содержит состав заказа и ссылку на статус

## Why Deferred

OPS-01 невозможно реализовать в Phase 5 по одной причине: адрес email клиента не собирается в форме checkout витрины. Отправить транзакционное письмо-подтверждение без адреса получателя невозможно. Поле `customer_email` в форме заказа отсутствует — оно не передаётся в `orders.post.ts` и не хранится в таблице `orders`. Это зафиксировано в решении D-01 (`.planning/phases/05-operational-features/05-CONTEXT.md`, раздел `OPS-01 — Транзакционный email (DEFERRED)`): "customer_email не обязателен при оформлении заказа и практически не собирается. Email-подтверждение невозможно без email-адреса. Требование требует сначала добавить поле email в checkout — это отдельная задача."

## Prerequisite Work

Перед началом реализации OPS-01 необходимо выполнить следующее:

1. Добавить опциональное поле `customer_email` в форму checkout витрины (компонент предположительно находится под `apps/storefront/features/checkout/` или `apps/storefront/pages/checkout.vue` — уточнить при планировании).
2. Добавить колонку `customer_email` в таблицу `orders` через Supabase-миграцию — или проверить, существует ли она уже в схеме, перед тем как начинать планирование (`SELECT column_name FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_email';`).
3. Обновить API создания заказа `apps/storefront/server/api/orders.post.ts` — принимать и сохранять `customer_email` из тела запроса (поле опциональное: отсутствие email не должно блокировать создание заказа).
4. Отобразить `customer_email` в детальной карточке заказа в admin-панели — для поддержки и трассируемости.

## Implementation Outline (when un-deferred)

- **Trigger:** Postgres database webhook на INSERT в таблицу `orders` — асинхронный, не блокирует создание заказа и не влияет на checkout flow.
- **Edge Function:** `supabase/functions/send-order-email/index.ts` (Deno runtime — проектный паттерн; аналогичные функции уже существуют в `supabase/functions/`).
- **Email provider:** Resend (предпочтительный кандидат — упомянут в STATE.md Research Flags: "Resend API key availability unconfirmed"; необходимо подтвердить наличие аккаунта и API-ключа до начала планирования) ИЛИ self-hosted SMTP через существующую GoTrue email-инфраструктуру в `apps/ops/`.
- **Шаблон письма:** HTML email с составом заказа (items, totals, статус оплаты, условия доставки) и ссылкой на `/order/{id}?t={guest_token}` — та же ссылка, которую использует OPS-02 (страница статуса заказа, уже реализована).
- **Idempotency:** использовать таблицу `processed_webhook_events` (уже существует в проекте, зафиксирована в TECHDEBT.md) для защиты от дублирующих отправок при повторных webhook-вызовах. Ключ идемпотентности: `order_id + event_type='email_confirmation'`.
- **Fallback:** если `customer_email` в заказе пустой или null — функция завершается без ошибки (silent skip, никаких логов ошибки).

## Acceptance Criteria

- [ ] Клиент, указавший email при оформлении заказа, получает транзакционное письмо в течение 2 минут; письмо содержит состав заказа и ссылку на `/order/{id}?t={token}`.
- [ ] Отправка письма идемпотентна — повторные вызовы webhook не приводят к дублированию писем (защита через `processed_webhook_events`).
- [ ] Ошибка отправки (5xx от провайдера, rate-limit) фиксируется в Sentry/GlitchTip с тегом `order_id` и НЕ препятствует созданию заказа.
- [ ] Если `customer_email` не указан при checkout — письмо не отправляется и ошибка не логируется (silent skip — корректное поведение).

## Out of Scope for OPS-01

Следующее явно выходит за рамки требования OPS-01 и не должно включаться при реализации:

- SMS-уведомления и push-уведомления клиентам
- Маркетинговые письма, рассылки, напоминания
- Многоязычные шаблоны (только русский язык — аудитория CIS)
- Вложения в письмах (PDF-чек, QR-код)
- Письма для других событий (изменение статуса заказа, отмена и т.д.) — это отдельное требование

## Risk if Never Shipped

Клиент должен полагаться на страницу `/order/{id}` по прямому редиректу сразу после checkout (OPS-02) — если ссылка потеряна (закрыта вкладка, очищена история), клиент теряет возможность отслеживать свой заказ (само заведение при этом заказ получает).

## References

- `.planning/phases/05-operational-features/05-CONTEXT.md` — решение D-01: OPS-01 перенесён в backlog
- `.planning/phases/05-operational-features/05-RESEARCH.md` — разделы `user_constraints` (Locked Decisions: OPS-01 DEFERRED) и `phase_requirements` (OPS-01: DEFERRED to backlog)
- `.planning/STATE.md` — Research Flag: "Resend API key availability unconfirmed — verify before Phase 5 planning"
