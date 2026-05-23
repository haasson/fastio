# Requirements: Fastio

**Defined:** 2026-05-21
**Core Value:** Заказ клиента поступает в заведение без потерь и задержек

## v1 Requirements

Requirements для launch readiness milestone. Каждый маппируется на фазу.

### Security

- [ ] **SEC-01**: Аудит RLS — все таблицы имеют политики Row Level Security, нет утечки данных между тенантами
- [ ] **SEC-02**: Service-role CI проверка — post-build grep убеждается, что service-role ключ не попал в клиентский бандл
- [ ] **SEC-03**: Tenant middleware hardening — `getTenantDb()` выбрасывает исключение (не silently fallback) если `event.context.tenant` не разрешился
- [x] **SEC-04**: Staging environment — отдельный Supabase-проект для E2E тестов, полностью изолированный от продакшна

### Observability

- [ ] **OBS-01**: Error monitoring — GlitchTip self-hosted задеплоен в Coolify, `@sentry/nuxt` SDK настроен с `--import` флагом в стартовой команде, source maps загружаются при деплое
- [ ] **OBS-02**: Telegram алерты — уведомления об ошибках и падениях приходят в Telegram-бот команды

### E2E Testing

- [ ] **E2E-01**: Order P0 flow — полный сценарий: клиент выбирает позиции → оформляет заказ → заказ появляется в панели заведения
- [ ] **E2E-02**: Auth flow — регистрация нового тенанта, вход существующего пользователя, инвайт-ссылка сотрудника
- [ ] **E2E-03**: Cross-tenant isolation — тест подтверждает, что авторизованный тенант-A не видит данные тенант-B через API
- [ ] **E2E-04**: Onboarding владельца — регистрация, создание заведения, настройка меню, публикация витрины

### Performance & SEO

- [ ] **PERF-01**: OG/SEO метаданные — каждая витрина тенанта отдаёт корректные `og:title`, `og:image`, `og:description`; превью в Telegram/WhatsApp показывает данные заведения
- [ ] **PERF-02**: Core Web Vitals — Lighthouse CI добавлен в pipeline, LCP < 2.5s, CLS < 0.1 для страниц витрины
- [ ] **PERF-03**: Оптимизация изображений — `@nuxt/image` интегрирован на витрине, явные размеры, WebP, lazy load
- [ ] **PERF-04**: CDN кэширование — `routeRules` SWR настроен с `Vary: Host` чтобы не смешивать кэши разных тенантов

### Infrastructure

- [x] **INFRA-01**: Ops Server — отдельный Nuxt/Nitro-сервис `apps/ops/` без UI, деплой на ops.fastio.ru. Telegram notify-хендлеры, cron-триггеры и email-шаблоны выделены из apps/admin и supabase/templates в единое место ответственности.

### Reliability

- [ ] **REL-01**: Realtime channel cleanup — аудит всех composable использующих `useRealtimeList`/`useRealtimeWatch`; каждый вызов имеет `removeChannel` в `onUnmounted`

### Operational Features

- [ ] **OPS-01**: Транзакционный email — клиент получает подтверждение заказа по email (Resend + Edge Function), письмо содержит состав заказа и ссылку на статус **[DEFERRED → .planning/deferred/OPS-01-transactional-email-PLAN.md, см. Phase 5 D-01]**
- [ ] **OPS-02**: Страница статуса заказа — клиент видит актуальное состояние своего заказа по уникальной ссылке без авторизации
- [ ] **OPS-03**: Легальные страницы — пользовательское соглашение и политика конфиденциальности доступны на витрине каждого тенанта

## v2 Requirements

Признаны важными, откладываются до первых клиентских фидбеков.

### Observability

- **OBS-v2-01**: Log aggregation — Grafana + Loki + Promtail для централизованных логов Nitro
- **OBS-v2-02**: Uptime monitoring — Uptime Kuma v2 с уведомлениями при падении

### Analytics

- **ANA-v2-01**: Базовый дашборд — выручка, количество заказов, топ позиций (данные уже в БД)

### Notifications

- **NOTF-v2-01**: Telegram-уведомления о заказах — владелец получает уведомление о новом заказе в Telegram (инфраструктура Edge Function уже есть)

### Technical

- **TECH-v2-01**: Webhook TTL (YooKassa) — `processed_webhook_events` таблица получает TTL-миграцию и cron-очистку (критично перед включением YooKassa в проде)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Нативные приложения (iOS/Android) | Web-first для запуска, вернуться по запросу |
| POS/фискальная интеграция (АТОЛ, Эвотор) | Сложность + зависимость от клиентского парка оборудования |
| Программа лояльности с баллами | v2+ по явному запросу клиентов |
| Full BI / расширенная аналитика | Не нужна на старте, перегружает интерфейс |
| Инвентаризация / управление складом | Out of scope для v1 по определению продукта |
| Маркетинговая CRM | Другой продукт |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| SEC-03 | Phase 1 | Pending |
| SEC-04 | Phase 1 | Complete |
| OBS-01 | Phase 2 | Pending |
| OBS-02 | Phase 2 | Pending |
| REL-01 | Phase 2 | Pending |
| E2E-01 | Phase 3 | Pending |
| E2E-02 | Phase 3 | Pending |
| E2E-03 | Phase 3 | Pending |
| E2E-04 | Phase 3 | Pending |
| PERF-01 | Phase 4 | Pending |
| PERF-02 | Phase 4 | Pending |
| PERF-03 | Phase 4 | Pending |
| PERF-04 | Phase 4 | Pending |
| INFRA-01 | Phase 4.1 | Complete |
| OPS-01 | Phase 5 | Deferred → backlog |
| OPS-02 | Phase 5 | Pending |
| OPS-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-21*
*Last updated: 2026-05-21 after initial definition*
