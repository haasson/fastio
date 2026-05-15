# Fastio

Мультитенантная SaaS-платформа для ресторанов, кафе, салонов и других бизнесов. Каждый тенант получает собственную витрину (по поддомену `slug.fastio.ru` или кастомному домену) и панель администратора для управления меню, заказами, бронированиями, онлайн-записью и настройками.

---

## Структура монорепо

```
fastio/
├── apps/
│   ├── admin/        — Nuxt 3 SPA (SSR off),  панель администратора           :4710
│   ├── storefront/   — Nuxt 3 SSR,  витрина покупателя (slug.fastio.ru)        :4711
│   ├── landing/      — Nuxt 3 SSR,  лендинг + регистрация тенантов (fastio.ru) :4713
│   ├── backoffice/   — Nuxt 3 SPA,  внутренний операционный кабинет            :4712
│   └── help/         — Nuxt 3 SSR,  публичная база знаний + AI-ассистент       :4712
├── packages/
│   ├── shared/       — @fastio/shared:    TypeScript-типы + утилиты домена
│   ├── ui/           — @fastio/ui:        UI-библиотека (Naive UI) для admin
│   ├── public-ui/    — @fastio/public-ui: UI-компоненты для storefront
│   ├── kit/          — @fastio/kit:       общий рантайм-кит storefront/public-ui
│   ├── icons/        — @fastio/icons:     SVG-иконки (Lucide + UiIcon)
│   ├── styles/       — @fastio/styles:    design-tokens, миксины медиа-запросов
│   └── kb/           — @fastio/kb:        markdown-контент базы знаний
├── supabase/
│   ├── migrations/   — SQL-миграции (schema, RLS, realtime, pg_cron)
│   └── functions/    — Edge Functions (Deno)
└── scripts/
    ├── create-tenant.mjs      — CLI создания тенанта
    ├── codemap/               — генерация карт кода для AI-агентов
    └── features/              — валидация и генерация feature-манифестов
```

Монорепо управляется через **pnpm workspaces** + **Turborepo**. Auto-import в Nuxt **отключён** — всё импортировать явно.

---

## Стек

| Слой | Технологии |
|---|---|
| Frontend | Nuxt 3, Vue 3.5, Pinia v3 (setup API), VueUse |
| UI | Naive UI (admin), Reka UI / vaul-vue (storefront) |
| Backend | Self-hosted Supabase: PostgreSQL 15, GoTrue, Realtime, Edge Runtime, Storage |
| Edge Functions | Deno 2.x, 11 функций (см. ниже) |
| Email | SMTP через Timeweb Mail (`smtp.timeweb.ru:465`) |
| Платежи | ЮKassa (вебхук → Edge Function `payment-webhook`) |
| Файлы / CDN | Timeweb S3 (`s3.twcstorage.ru`), CDN `cdn.fastio.ru` |
| Деплой | Coolify v4 на Timeweb Cloud VPS |
| Прокси / SSL | Traefik (встроен в Coolify) + Let's Encrypt DNS-01 (wildcard `*.fastio.ru`) |
| CI/CD | GitHub Actions (lint / typecheck / tests / migrate) |
| Инструменты | pnpm 9.15.0, Turborepo 2, TypeScript 5, ESLint, Vitest |

---

## Инфраструктура (Coolify + self-hosted Supabase)

### VPS

- **Провайдер**: Timeweb Cloud, регион NSK-1
- **Параметры**: 4 vCPU / 8 GB RAM / 80 GB NVMe SSD
- **IP**: `109.71.242.205`
- **OS**: Ubuntu 24.04 LTS, Docker 29.4.3

### Coolify

Все приложения деплоятся как отдельные **Coolify Applications** (GitHub → auto-deploy на push в `main`).

- Coolify UI: https://coolify.fastio.ru
- GitHub App: `coolify-haasson` (приватный репо `github.com/haasson/fastio`)

### Supabase (self-hosted)

Развёрнут как **Coolify Service** по шаблону. Компоненты: PostgreSQL, GoTrue, Realtime, Storage, Edge Runtime, Kong.

- Supabase Studio: https://db.fastio.ru
- API: `https://db.fastio.ru` (через Kong)

> Secrets: DASHBOARD_USERNAME/PASSWORD, POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY — в **Bitwarden** («FastIO Supabase Self-hosted»).

### Traefik / SSL

Встроен в Coolify. Wildcard-сертификат `*.fastio.ru` через **DNS-01 challenge** (Timeweb Cloud API).

- Конфиг прокси: `/data/coolify/proxy/dynamic/storefront-wildcard.yaml` на VPS
- `*.fastio.ru` роутится на storefront-контейнер

### DNS (Timeweb Cloud, DNS-зона fastio.ru)

| Запись | Значение |
|---|---|
| `fastio.ru` | A → `109.71.242.205` |
| `admin`, `backoffice`, `help`, `db`, `coolify`, `new` | A → `109.71.242.205` |
| `*.fastio.ru` | A → `109.71.242.205` (wildcard для тенант-витрин) |
| `cdn` | CNAME → `qjb8tvuohx.cdn.twcstorage.ru` |

### Timeweb S3 / CDN

- Бакет **`fastio-storage`** — public, фото блюд / баннеры / загрузки тенантов
- Бакет **`fastio-backups`** — private, pg_dump бэкапы (ежедневный cron, WIP)
- S3 endpoint: `https://s3.twcstorage.ru`
- CDN TTL: 7 дней

### Действующие URL

| Сервис | URL | Статус |
|---|---|---|
| Лендинг | https://fastio.ru | ✅ |
| Admin | https://admin.fastio.ru | ✅ |
| Backoffice | https://backoffice.fastio.ru | ✅ |
| База знаний | https://help.fastio.ru | ✅ |
| Supabase Studio | https://db.fastio.ru | ✅ |
| Coolify UI | https://coolify.fastio.ru | ✅ |
| CDN | https://cdn.fastio.ru | ⏳ SSL pending |
| Витрина тенанта | https://`<slug>`.fastio.ru | ✅ (тенанты в БД) |

---

## Приложения

### `apps/admin` — Панель администратора

**SSR выключен** (чистый SPA). Аутентификация через Supabase Auth.

Модульная архитектура `features/<X>/` — каждая фича изолирована: `api/`, `composables/`, `components/`, `stores/`. Барьер изоляции через ESLint + barrel-файлы.

Вертикали: **retail** (меню, заказы, кухня, столы, бронирования, акции) и **services** (услуги, онлайн-запись).

### `apps/storefront` — Витрина покупателя

**SSR включён**. Тенант определяется по hostname на сервере (поддомен → slug или custom domain). Вся коммуникация с БД — через Nitro server endpoints (прямой Supabase из браузера не используется).

Поддерживает два режима аутентификации покупателя: email/password (Supabase Auth) и Telegram Login Widget (кастомная sliding session + HttpOnly cookie).

### `apps/landing` — Лендинг + регистрация

**SSR включён**. Публичный лендинг `fastio.ru` + форма регистрации тенанта (`/register`). После регистрации вызывает edge function `send-new-tenant-email` и программно добавляет поддомен через Coolify API.

### `apps/backoffice` — Внутренний кабинет

**SSR выключен** (SPA). Операционная панель для внутренней команды. Защищён Basic Auth (WIP).

### `apps/help` — База знаний

**SSR включён**. Публичная документация и инструкции на https://help.fastio.ru. Использует пакет `@fastio/kb` с markdown-контентом. Имеет AI-ассистент на базе Claude API.

---

## Edge Functions (Deno)

Деплоятся в self-hosted Supabase Edge Runtime (11 функций + `_shared/`):

| Функция | Назначение |
|---|---|
| `send-order-email` | Database Webhook при INSERT в orders → email тенанту |
| `payment-webhook` | Вебхук ЮKassa → обновляет статус подписки |
| `add-custom-domain` | Добавляет кастомный домен тенанта через Coolify API |
| `send-new-tenant-email` | Email при регистрации нового тенанта |
| `send-recovery-email` | Email восстановления пароля |
| `invite-member` | Отправка приглашения в команду |
| `accept-invite` | Принятие приглашения |
| `get-invite` | Получение данных приглашения |
| `list-team` | Список участников команды |
| `dadata-suggest` | Прокси Dadata API (адреса / ФИО) |
| `proxy-image` | Прокси-обработка изображений |

---

## Схема данных (PostgreSQL)

```
tenants, tenant_members, tenant_invitations  — мультитенантность, RBAC
plans, subscriptions                         — тарифы и биллинг
categories, dishes, dish_tags, combos        — меню (retail)
service_categories, services                 — каталог услуг (services)
orders, order_items, delivery_zones          — заказы (retail)
appointments, appointment_groups             — онлайн-запись (services)
reservations                                 — бронирования столов (retail)
tables, table_calls                          — залы и столы (retail)
promotions, promo_codes                      — акции
customers, customer_sessions                 — покупатели витрины
banners, galleries, reviews, vacancies       — контент
processed_webhook_events                     — дедупликация вебхуков
```

**RLS**: все таблицы тенантов защищены через `is_tenant_member()` / `has_tenant_role()`. Публичные данные (меню, тенант) читаются анонимно.

**pg_cron**: очистка протухших сессий, reminder-уведомления для записи.

---

## CI/CD (GitHub Actions)

### `ci.yml` — запускается на PR и push в `main`

- `pnpm typecheck` — TypeScript по всему монорепо
- `pnpm lint` — ESLint
- `pnpm test:run` — Vitest
- `pnpm features:validate` + `pnpm storefront-features:validate` — проверка feature-манифестов
- Deno lint + typecheck + тесты edge functions

### `migrate.yml` — запускается при изменениях в `supabase/migrations/**`

Применяет новые SQL-миграции на self-hosted Postgres через прямое подключение psql (`109.71.242.205:5432`). Отслеживает применённые версии через `supabase_migrations.schema_migrations`.

**GitHub Secret**: `SELFHOSTED_DB_PASSWORD` — пароль Postgres (raw, без URL-encoding).

---

## Локальная разработка

### Требования

- Node.js ≥ 20
- pnpm 9.15.0
- Docker Desktop (для локального Supabase)

### Установка и запуск

```bash
# Установка зависимостей
pnpm install

# Запустить локальный Supabase (Docker Desktop должен быть запущен)
pnpm supabase:start
# → выводит URL и ключи для .env.local

# Запустить admin + storefront одновременно
pnpm dev

# Или по отдельности
pnpm dev:admin        # :4710
pnpm dev:storefront   # :4711
pnpm dev:landing      # :4713
pnpm dev:help         # :4712
pnpm dev:backoffice   # :4712

# Supabase Studio (локальный UI для БД)
pnpm supabase:studio

# Остановить Supabase
pnpm supabase:stop
```

### Переменные окружения

Создай `.env.local` в каждом аппе. Ключи берёшь из вывода `pnpm supabase:start`.

**`apps/admin/.env.local`**
```env
NUXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NUXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key из supabase start>
```

**`apps/storefront/.env.local`**
```env
NUXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NUXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NUXT_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NUXT_PUBLIC_YANDEX_MAPS_API_KEY=<ключ>
NUXT_DADATA_API_KEY=<ключ>
NUXT_TELEGRAM_AUTH_BOT_TOKEN=<токен>
NUXT_PUBLIC_TELEGRAM_AUTH_BOT_USERNAME=fastio_login_bot
```

**`apps/landing/.env.local`**
```env
NUXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NUXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NUXT_SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
NUXT_FASTIO_INTERNAL_TOKEN=<любой hex для локала>
NUXT_ADMIN_URL=http://localhost:4710
```

**`apps/backoffice/.env.local`**
```env
NUXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NUXT_BACKOFFICE_USER=admin
NUXT_BACKOFFICE_PASS=secret
NUXT_FASTIO_INTERNAL_TOKEN=<тот же что в landing>
```

### Создание тенанта локально

```bash
pnpm create-tenant --name "Пицца Васи" --slug vasya-pizza --email owner@example.com --password secret123
```

### Применить новую миграцию локально

Просто создай файл в `supabase/migrations/` — применится автоматически при следующем `pnpm supabase:start`.

Или вручную:

```bash
supabase db push
```

> ⛔ **НИКОГДА не запускать `supabase db reset`** — дропает всю базу и уничтожает данные.

---

## Деплой (Coolify)

Деплой происходит **автоматически** при push в `main` через Coolify GitHub App.

Если нужно передеплоить вручную — зайди в Coolify UI → нужный Application → **Redeploy**.

### Применить новую миграцию на прод

Просто создай файл в `supabase/migrations/` и запушь в `main`. `migrate.yml` применит её автоматически.

Если нужно вручную через SSH:

```bash
# Сначала скопировать с мака:
scp supabase/migrations/<новая>.sql root@109.71.242.205:/tmp/

# Затем на VPS:
ssh root@109.71.242.205
docker exec -i supabase-db-sox6wn6mth1wotz1yomzwh5i \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 < /tmp/<новая>.sql
```

### Деплой Edge Functions

```bash
# Деплой через Supabase CLI (нужен .env с SUPABASE_DB_URL и ключами)
pnpm supabase:deploy:functions

# Или скопировать файлы вручную на VPS в volume:
# /data/coolify/services/sox6wn6mth1wotz1yomzwh5i/volumes/functions/
# Затем перезапустить edge-runtime:
# docker restart supabase-edge-functions-sox6wn6mth1wotz1yomzwh5i
```

---

## Полезные команды

```bash
# Проверить типы
pnpm typecheck

# ESLint
pnpm lint

# Stylelint (.vue / .scss)
pnpm lint:style

# Тесты (watch)
pnpm test

# Тесты (однократно)
pnpm test:run

# Проверить feature-манифесты
pnpm features:validate
pnpm storefront-features:validate

# Создать новую feature (admin)
pnpm new:feature <name>

# Создать новую feature (storefront)
pnpm new:storefront-feature <name> --vertical=<retail|services|shared>

# Проверить dep-граф монорепо
pnpm audit:deps

# Полная регенерация codemap-карт (для AI-агентов)
pnpm codemap:scan --all
```

### Диагностика на VPS

```bash
# Логи edge functions
docker logs supabase-edge-functions-sox6wn6mth1wotz1yomzwh5i --tail 100

# Логи GoTrue (Supabase Auth)
docker logs supabase-auth-sox6wn6mth1wotz1yomzwh5i --tail 100

# Найти нужный app-контейнер по env-маркеру
for c in $(docker ps --format '{{.Names}}' | grep -v supabase | grep -v coolify); do
  echo "=== $c ==="
  docker inspect $c --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -E "NUXT_PUBLIC_SITE_URL|NUXT_PUBLIC_HELP_URL|NUXT_BACKOFFICE_USER|COOLIFY_FQDN"
done

# Проверить количество тенантов
docker exec supabase-db-sox6wn6mth1wotz1yomzwh5i \
  psql -U postgres -d postgres -c "SELECT count(*) FROM tenants;"
```

---

## Архитектура — ключевые принципы

- **SPA для admin** — нет SSR, быстрый dev, нет проблем с авторизацией
- **SSR для storefront / landing / help** — SEO, быстрый first paint
- **RLS на уровне БД** — безопасность через SQL, не через код приложения
- **Supabase Realtime** — каналы для заказов, кухни, столов без polling
- **Модульность** — `features/<X>/` с барьерами ESLint + barrel-файлы; tenant modules включают/выключают разделы
- **Нет auto-import** — все импорты явные (Vue, Nuxt composables, всё прочее)
- **`useDatabase()` агрегатор** — единая точка входа ко всем API-модулям в admin
- **`useGate()` проверка доступа** — учитывает 7 слоёв: subscription → plan → businessType → module → role → config → flags

Подробнее: `docs/architecture.md`, `docs/vertical-isolation.md`, `docs/coolify-migration-handoff.md`.
