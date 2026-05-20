# Fastio

## What This Is

Fastio — SaaS-платформа для заведений малого и среднего бизнеса: кафе, рестораны, бары, салоны красоты, ритейл, сервисные точки. Владельцу и персоналу — веб-админка для управления меню, заказами, командой и настройками. Клиентам — брендированный SSR-сайт-витрина для просмотра меню и оформления заказов.

## Core Value

Заказ клиента должен поступить в заведение без потерь и задержек — всё остальное второстепенно.

## Requirements

### Validated

Реализовано и работает в кодовой базе:

- ✓ Онбординг владельца — регистрация тенанта, настройка заведения — existing
- ✓ Аутентификация — вход, сессии, инвайт-ссылки для сотрудников — existing
- ✓ Меню / каталог — категории, позиции, цены, CRUD — existing
- ✓ Сервисный каталог — услуги для appointments-вертикали — existing
- ✓ Онлайн-витрина — SSR-сайт для клиентов с мультитенантным роутингом (host → tenant) — existing
- ✓ Приём заказов — оформление, статусы, передача в заведение — existing
- ✓ Записи (appointments) — бронирование услуг — existing
- ✓ Бронирование столиков (reservations/tables) — existing
- ✓ Кухонный экран (kitchen) — отображение заказов для персонала — existing
- ✓ Команда — роли, приглашения, управление сотрудниками — existing
- ✓ Промоакции — скидки, специальные предложения — existing
- ✓ Биллинг — подписки, оплата тарифа — existing
- ✓ Бренд и внешний вид — кастомизация витрины — existing
- ✓ Несколько точек (branches) — multi-location support — existing
- ✓ Audit log — история действий — existing
- ✓ AI-ассистент — existing
- ✓ Контент-страницы — existing
- ✓ База знаний (help/kb) — existing

### Active

Следующий этап — доведение до production-ready:

- [ ] E2E-тесты для критических флоу (заказ → оплата → получение в заведении)
- [ ] Мониторинг и алертинг в продакшне (ошибки, latency, uptime)
- [ ] Устранение известных UX-проблем и критических багов
- [ ] Производительность витрины: Core Web Vitals, SEO-метаданные
- [ ] Документация для команды

### Out of Scope

- Нативные мобильные приложения — web-first для запуска
- Внешние интеграции с кассами (АТОЛ, Эвотор) — после первой волны клиентов
- Программа лояльности с баллами — v2 по запросу клиентов

## Context

**Стек:** Nuxt 3 (SPA + SSR), Vue 3, TypeScript, Pinia, Supabase (PostgreSQL + Auth + Realtime + Edge Functions), pnpm monorepo + Turborepo.

**Приложения:** `apps/admin` (SPA, port 4710), `apps/storefront` (SSR), `apps/help`, `apps/backoffice`, `apps/landing`.

**Мультитенантность:** каждый тенант — отдельная строка в БД; витрина определяет тенанта по hostname в `server/middleware/tenant.ts`.

**301+ миграция БД** — зрелая схема, все основные домены покрыты.

**Фокус текущего этапа:** качество, не фичи. Первый платящий клиент не должен наткнуться на критические баги.

## Constraints

- **Tech stack**: Nuxt 3 / Vue 3 / Supabase — менять стек не планируется
- **Timeline**: не зафиксирован, приоритет качества над сроками
- **Тест-стратегия**: E2E для критических флоу достаточно для запуска; unit-тесты бизнес-логики как бонус

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SSR для витрины, SPA для админки | SEO и скорость загрузки для клиентов; сложный UI для владельцев не нуждается в SSR | ✓ Good |
| Мультитенантность через host-заголовок | Простота деплоя, один инстанс — много клиентов | — Pending |
| Supabase как backend | Быстрый старт, встроенная Auth/Realtime, managed PostgreSQL | — Pending |
| Фокус на web, не native | Ресурсы малого стартапа, web достаточен для MVP | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-20 after initialization*
