---
focus: stack
date: 2026-05-10
---
# Stack Research

## Self-hosted Supabase + Coolify

### Версии и статус (2025-2026)
- Coolify предоставляет Supabase как готовый one-click сервис (Service template). Это рекомендованный путь — Docker Compose с ~10 контейнерами разворачивается автоматически.
- Supabase self-hosted работает на Docker Compose, управляемом Coolify. Минимум RAM: 4 GB (рекомендуется 8+ для production).
- В 2026 Supabase перешёл на асимметричные JWT-ключи (ES256 вместо HS256). При миграции это важно — старые токены с платформы не будут валидны, пользователям придётся перелогиниться.

### Развёртывание на Coolify
1. В Coolify: New Service → Supabase → заполнить env-переменные (POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY).
2. **POOLER_TENANT_ID** — задаётся ДО первого старта, потом менять только через миграции БД.
3. Coolify проксирует порт PostgreSQL 5432 через Traefik/Nginx. Для временного прямого доступа (например, при миграции) нужно вручную открыть порт в docker-compose секции `ports` в Coolify и перезапустить.
4. После первого запуска — немедленно сменить все дефолтные credentials.

### Известные gotchas
- **Публичный доступ к DB**: есть баг в Coolify — галочка «Make publicly accessible» для PostgreSQL может не работать. Workaround: вручную добавить `"5432:5432"` в ports в Compose-файле через Coolify UI.
- **Studio UI**: в self-hosted версии некоторые разделы Studio не работают (Projects, Project Settings). Функционал таблиц и SQL-редактора работает, но интерфейс урезан по сравнению с cloud.
- **Edge Functions**: self-hosted Edge Functions используют Deno runtime. Файлы `deno.json` и import maps нужно добавлять вручную — суpabase CLI их не выгружает при `functions deploy`.
- **Realtime**: работает, но при высокой нагрузке требует тюнинга `max_connections` в Postgres.
- **Storage**: S3-совместимое хранилище по умолчанию локальное (в контейнере). Для production — переключить на внешний S3/R2 через env `STORAGE_BACKEND=s3` + соответствующие переменные.

### Миграция с Supabase Cloud
Официальная документация: `supabase db dump` (CLI) — выгружает три файла: roles, schema, data.

```bash
# 1. Дамп с cloud-проекта
supabase db dump --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  -f roles.sql --role-only
supabase db dump --db-url "..." -f schema.sql --schema-only
supabase db dump --db-url "..." -f data.sql --data-only --use-copy

# 2. Восстановление в self-hosted (временно открыть порт 5432)
psql -h [SELF_HOSTED_IP] -U postgres -f roles.sql
psql -h [SELF_HOSTED_IP] -U postgres -d postgres -f schema.sql
psql -h [SELF_HOSTED_IP] -U postgres -d postgres -f data.sql
```

**Что переносится автоматически:** schema, data, auth.users (пользователи сохраняются).

**Что нужно делать отдельно:**
- Storage objects (файлы) — нужно перенести вручную через S3 sync или rclone
- Edge Functions + deno.json / import maps — деплоить заново через CLI
- Кастомные триггеры/RLS в auth.* и storage.* схемах — проверить через `supabase db diff`
- После миграции: все существующие сессии пользователей инвалидируются (другой JWT secret)

**Ресурсы:**
- [Restore a Platform Project to Self-Hosted | Supabase Docs](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
- [How to self-host Supabase with Coolify and migrate | msof.me](https://msof.me/blog/how-to-self-host-supabase-with-coolify-and-migrate-your-project-from-the-official-supabase-platform/)
- [Supabase | Coolify Docs](https://coolify.io/docs/services/supabase)
- [Self-hosting: What's working (and what's not)? GitHub Discussion](https://github.com/orgs/supabase/discussions/39820)

---

## Nuxt 3 SSR Deployment on Coolify

### Подход
Coolify поддерживает деплой Nuxt 3 SSR через **Nixpacks** (рекомендуется — без Dockerfile) или через кастомный Dockerfile.

### Конфигурация через Nixpacks (проще всего)
В Coolify UI при создании приложения:
- **Build Pack:** `nixpacks`
- **Start Command:** `node .output/server/index.mjs`
- **Port:** `3000` (дефолт для Nitro)

Nixpacks автоматически определит Node.js, установит зависимости (`pnpm install`) и соберёт проект. Для монорепо (pnpm workspaces + Turborepo) нужно дополнительно указать **Root Directory** и при необходимости **Build Command** вручную.

### Конфигурация через Dockerfile (больше контроля)

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
# Копировать все workspace-пакеты
COPY packages/ ./packages/
COPY apps/storefront/ ./apps/storefront/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter=storefront build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/apps/storefront/.output ./.output
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

### Монорепо-специфика
- Coolify умеет работать с монорепо — указать `Root Directory` в настройках приложения (например, `apps/storefront`)
- При Nixpacks Coolify читает `package.json#scripts.build` выбранного проекта
- Для Turborepo: команда сборки `pnpm turbo run build --filter=storefront` или `pnpm --filter=storefront build`

### Важные нюансы
- Переменные окружения (SUPABASE_URL, SUPABASE_KEY и т.д.) задаются в Coolify UI — они инжектятся в рантайм
- Для Nuxt с `@sentry/nuxt` нужно передать `SENTRY_AUTH_TOKEN` как build-time переменную для загрузки source maps
- Health check: Coolify по умолчанию проверяет `/` — можно настроить кастомный endpoint

**Ресурсы:**
- [Nuxt | Coolify Docs](https://coolify.io/docs/applications/nuxt)
- [Self-Host Your Nuxt App With Coolify | mokkapps.de](https://mokkapps.de/blog/self-host-your-nuxt-app-with-coolify)
- [Dockerizing a Nuxt App | mokkapps.de](https://mokkapps.de/blog/dockerizing-a-nuxt-app)

---

## Database Backups

### Стратегия для self-hosted Supabase

Supabase Cloud делает бэкапы автоматически — в self-hosted это полностью на нас. Минимальная стратегия: ежедневный `pg_dump` → Cloudflare R2 (или другой S3-compatible).

### Почему Cloudflare R2
- S3-совместимый API
- **Нет egress fees** (в отличие от AWS S3)
- Бесплатный tier: 10 GB хранилища + 10M запросов/месяц
- Для России: Timeweb Cloud S3 — более разумный вариант (latency, оплата), R2 — если важна стоимость и нет ограничений

### Готовые Docker-решения

**Вариант 1 — простой контейнер (pg-r2-backup):**
```yaml
# docker-compose.yml (Coolify service или отдельный контейнер)
services:
  pg-backup:
    image: ghcr.io/jacksonkasi0/postgres-r2-backup:latest
    environment:
      POSTGRES_URI: "postgresql://postgres:password@supabase-db:5432/postgres"
      R2_BUCKET: "fastio-backups"
      R2_ENDPOINT: "https://<account-id>.r2.cloudflarestorage.com"
      R2_ACCESS_KEY_ID: "..."
      R2_SECRET_ACCESS_KEY: "..."
      BACKUP_SCHEDULE: "0 3 * * *"  # 03:00 UTC ежедневно
      RETENTION_DAYS: "30"
```

**Вариант 2 — скрипт через Coolify Cron:**
```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="fastio_backup_${TIMESTAMP}.sql.gz"

pg_dump "$POSTGRES_URI" | gzip | \
  aws s3 cp - "s3://fastio-backups/${FILENAME}" \
  --endpoint-url "https://<account-id>.r2.cloudflarestorage.com"

# Удалить старше 30 дней
aws s3 ls s3://fastio-backups/ | \
  awk '{print $4}' | \
  head -n -30 | \
  xargs -I{} aws s3 rm "s3://fastio-backups/{}" \
  --endpoint-url "..."
```

### Рекомендуемое расписание
| Тип | Периодичность | Хранение |
|-----|--------------|----------|
| Daily dump | Ежедневно в 03:00 | 30 дней |
| Weekly dump | Воскресенье | 3 месяца |
| Pre-migration snapshot | Вручную перед деплоем | Бессрочно |

### Point-in-Time Recovery
`pg_dump` даёт только snapshot. Для PITR нужен WAL archiving (pgBackRest, Barman) — это overhead на старте, можно отложить до роста нагрузки.

**Ресурсы:**
- [postgres-r2-backup GitHub](https://github.com/jacksonkasi0/postgres-r2-backup)
- [Automating Database Backups to Cloudflare R2 | Medium](https://medium.com/@GarisSpace/automating-database-backups-to-cloudflare-r2-using-docker-and-python-23f06761a2d3)
- [PostgreSQL backup to S3 | DEV Community](https://dev.to/finny_collins/postgresql-backup-to-s3-how-to-store-your-database-backups-in-the-cloud-b8f)

---

## Sentry + Nuxt 3

### Пакет
В проекте уже используется `@sentry/nuxt@^10.47.0` — это официальный пакет Sentry для Nuxt 3. Он оборачивает `@sentry/node` на сервере и `@sentry/vue` на клиенте.

**Минимальная версия Nuxt:** 3.7.0 (рекомендуется 3.14.0+). В проекте — `^3.15.0`, всё ок.

### Установка (автоматическая через CLI)
```bash
npx @sentry/wizard@latest -i nuxt
```
Wizard:
1. Добавит `@sentry/nuxt` в зависимости
2. Обновит `nuxt.config.ts` (добавит модуль + sourcemaps options)
3. Создаст `sentry.client.config.ts` и `sentry.server.config.ts`
4. Создаст `.env.sentry-build-plugin` с `SENTRY_AUTH_TOKEN`

### Ключевые файлы конфигурации

**`nuxt.config.ts`:**
```ts
export default defineNuxtConfig({
  modules: ['@sentry/nuxt/module'],
  sentry: {
    sourceMapsUploadOptions: {
      org: 'fastio',
      project: 'admin', // или 'storefront'
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
  },
  sourcemap: {
    client: 'hidden', // генерировать source maps, но не ссылаться в файлах
    server: true,
  },
})
```

**`sentry.client.config.ts`:**
```ts
import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% трейсов в production
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  integrations: [Sentry.replayIntegration()],
})
```

**`sentry.server.config.ts`:**
```ts
import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

### Запуск SSR-сервера с Sentry
Критически важный момент — Sentry на сервере должен быть загружен через `--import`:

```bash
node --import ./.output/server/sentry.server.config.mjs .output/server/index.mjs
```

Для Coolify: изменить **Start Command** с `node .output/server/index.mjs` на команду выше.

### Source Maps в CI/CD (Coolify)
`SENTRY_AUTH_TOKEN` нужен только при сборке для загрузки source maps. В Coolify добавить как build-time переменную (не runtime). Сами source maps в production лучше не отдавать клиенту — `sourcemap.client: 'hidden'` решает это.

### Для монорепо (два проекта: admin + storefront)
Создать два Sentry-проекта и задать разные DSN + project name в каждом приложении. Переменные (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`) задаются отдельно для каждого Coolify-приложения.

**Ресурсы:**
- [Nuxt | Sentry Docs](https://docs.sentry.io/platforms/javascript/guides/nuxt/)
- [Manual Setup | Sentry for Nuxt](https://docs.sentry.io/platforms/javascript/guides/nuxt/manual-setup/)
- [Integrate Sentry with your Nuxt 3 application | lichter.io](https://www.lichter.io/articles/nuxt3-sentry-recipe/)

---

## Recommendations

### Приоритет 1: Supabase self-hosted
1. Поднять Supabase через Coolify Service template на VPS (≥4GB RAM, рекомендуется 8GB). Timeweb Cloud — разумный выбор для РФ-клиентов.
2. Задать `POOLER_TENANT_ID` **до** первого запуска.
3. Сменить все дефолтные пароли (POSTGRES_PASSWORD, JWT_SECRET, DASHBOARD_PASSWORD) немедленно.
4. Перед миграцией — сделать full dump с Supabase Cloud. Проверить через `supabase db diff` есть ли кастомные триггеры в auth/storage схемах.
5. Предупредить (или не предупреждать, если v1) пользователей о принудительном ре-логине после миграции.
6. Storage: сразу настроить внешний S3-бэкенд (Timeweb S3 или R2) — не хранить файлы локально в контейнере.

### Приоритет 2: Деплой Nuxt 3
1. Для storefront (SSR) — Dockerfile с multi-stage build, Start Command с `--import sentry.server.config.mjs`.
2. Для admin (SPA, SSR off) — можно деплоить как статику через `nuxt generate` → Nginx/Coolify Static Site, это проще и дешевле (нет Node-сервера).
3. В Coolify задать отдельные env-переменные для каждого приложения. `SENTRY_AUTH_TOKEN` — только build-time.

### Приоритет 3: Бэкапы (до launch)
1. Запустить `postgres-r2-backup` контейнером в Coolify с расписанием `0 3 * * *`.
2. Хранение: 30 daily + 12 weekly. Для v1 достаточно R2 free tier.
3. Проверить восстановление до launch — сделать тестовый restore в dev-окружении.

### Приоритет 4: Sentry (до launch)
1. `@sentry/nuxt` уже в зависимостях — нужно только добавить конфиг-файлы и переменные.
2. В production установить `tracesSampleRate: 0.05-0.1` чтобы не сжечь квоту.
3. Alerting: настроить алерты на новые issues по email/Telegram (Sentry поддерживает webhook).
4. Для admin (SPA) Sentry работает только client-side — это нормально, там нет сервера.
