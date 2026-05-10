---
project: FastIO
milestone: v1 Launch
updated: 2026-05-10
---

# FastIO — v1 Launch

## What This Is

FastFood SaaS — мультитенантная платформа для автоматизации бизнеса. Даёт брендированный сайт (storefront SSR) и admin-панель для ресторанов, сервисов и продаж. Клиент регистрируется самостоятельно через лендинг, проходит онбординг-визард и начинает работу.

**Цель milestone:** дотянуть до первого реального платящего клиента.

## Core Value

Бизнес запускает свой онлайн-канал за 15 минут — без разработчика, без настройки сервера.

## Who It's For

Малый и средний бизнес в России: рестораны, кофейни, барбершопы, салоны красоты, студии.

## What's Already Built (Validated)

- ✓ Admin-панель — меню, заказы, кухня, столы, бронирования, онлайн-запись (визиты), акции, контент, внешний вид, настройки, команда
- ✓ Storefront SSR — секции, галерея, промокоды, SEO, Telegram-авторизация
- ✓ Мультитенантность — tenant_members, роли, RLS, switchTenant
- ✓ Модульная система — on/off на тенанта (orders, kitchen, tables, reservations, services, branches…)
- ✓ useGate — единая система контроля доступа (7 слоёв: plan, module, role, config…)
- ✓ Realtime — заказы, кухня, столы через Supabase Realtime
- ✓ Филиалы — branch-awareness в заказах, записях, меню
- ✓ Telegram-уведомления и напоминания о записях
- ✓ Edge Functions — email, payment-webhook, custom-domain, invite
- ✓ Cross-tenant isolation hardening (миграции 245+246, tenantDb Proxy)
- ✓ Design tokens в packages/ui
- ✓ KB контент (30+ markdown-файлов)

## What's Needed for Launch (Active)

### Инфра
- [ ] Coolify + self-hosted Supabase на Timeweb (план: `docs/plans/2026-04-27-migration-coolify.md`)
- [ ] Бэкапы базы данных (pg_dump по крону)
- [ ] Sentry error tracking (storefront + admin, включая server-side Nitro)

### Онбординг тенанта
- [ ] Self-registration flow на лендинге
- [ ] Onboarding wizard в admin (планы: `docs/plans/2026-04-23-onboarding-checklist-*.md`)

### Биллинг (базовый)
- [ ] Тарифные планы + лимиты в интерфейсе
- [ ] Enforcement лимитов по плану (через useGate)
- [ ] Ручное управление подписками через backoffice (без автооплаты в v1)

### Security
- [ ] Security fixes из `docs/plans/2026-05-06-security-fixes.md` (SSRF, rate limit, Telegram webhook верификация, Sentry)

### База данных
- [ ] Squash 261 миграции в единый слепок схемы (до первого реального тенанта)

## Out of Scope (v1)

- Автоматическая онлайн-оплата подписок (v2)
- AI-ассистент в admin (в разработке, не блокирует launch)
- Help-приложение (в разработке, не блокирует launch)
- Audit log (за feature flag, включим после launch)
- Мобильные приложения

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Self-hosted Supabase на Timeweb | Supabase Cloud заблокирован в России | — Pending |
| Coolify для деплоя | Vercel остаётся cold standby при падении | — Pending |
| Биллинг v1 без автооплаты | Ускоряет запуск, первые клиенты — ручное управление | — Accepted |
| Self-registration (не ручной онбординг) | Масштабируемость, нет зависимости от тебя | — Accepted |

## Context

Monorepo: pnpm workspaces + Turborepo. Apps: admin (Nuxt 3 SPA, 4710), storefront (Nuxt 3 SSR, 4711), landing (SSR, 4713), backoffice. Packages: shared, ui, public-ui, kit, icons, styles, kb. Backend: Supabase (PostgreSQL + RLS + Realtime + Storage + Edge Functions). Текущая БД: 261 миграция.

## Evolution

После каждой фазы: Requirements invalidated? → Out of Scope. Validated? → отметить. Новые? → добавить в Active.

---
*Last updated: 2026-05-10 after initialization*
