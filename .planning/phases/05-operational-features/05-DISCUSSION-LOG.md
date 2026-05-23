# Phase 5: Operational Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-05-23
**Phase:** 05-operational-features
**Mode:** discuss (standard)
**Areas analyzed:** Email trigger, Email provider, Order status real-time, Terms of Service page

---

## Discussion Summary

### OPS-01 — Email trigger
- **Question:** Где живёт логика отправки email после создания заказа?
- **Options presented:** Edge Function (webhook), apps/ops server, storefront/server inline
- **User response:** "нет у нас емейлов!" — email не собирается в checkout
- **Follow-up question:** OPS-01 говорит: «клиент получает подтверждение заказа по email». Что именно не так?
- **User answer:** Не собираем email в checkout
- **Decision:** OPS-01 → backlog. Нельзя отправить email без email-адреса клиента.

### OPS-02 — Order status real-time
- **Question:** Страница статуса уже есть с polling каждые 15с. Что со статусом?
- **Options presented:** Polling 15s (достаточно), Supabase Realtime subscription
- **User answer:** Polling 15s — достаточно
- **Decision:** OPS-02 уже реализован полностью. Верификация в execute.

### OPS-03 — Terms of Service
- **Question:** Что делаем с Terms of Service?
- **Options presented:** Новая страница /terms, offerUrl внешняя ссылка
- **User answer:** Новая страница /terms
- **Follow-up:** /terms — что показывать?
- **Options presented:** Шаблонный текст + legalInfo, Redirect на offerUrl
- **User answer:** Шаблонный текст + legalInfo (аналогично privacy.vue)
- **Decision:** Создать /terms с §1–4+ текстом оферты + данными из legalInfo. Добавить ссылку в футер.

---

## Codebase Findings (Scout)

- `apps/storefront/pages/order/[id].vue` — 284 строки, полностью реализована
- `apps/storefront/pages/privacy.vue` — модель для /terms, использует legalInfo
- `apps/storefront/shared/ui/sections/SiteFooter.vue` — уже имеет /privacy ссылку
- `packages/shared/src/types/tenant.ts` — `isLegalInfoComplete()` как условие показа

---

## Corrections Applied

- OPS-01 полностью выведен из скоупа (deferred) по результату обсуждения
- OPS-02 подтверждён как уже готовый

---

*Discussion log: 2026-05-23*
