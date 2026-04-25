# System Patterns: Fastio

## System Architecture
Монорепо с тремя Nuxt-приложениями и четырьмя пакетами. Бэкенд — полностью Supabase.

```
apps/
  admin/       — SPA, панель администратора
  storefront/  — SSR, витрина покупателя
  help/        — SSR, база знаний с AI-ассистентом
packages/
  shared/      — TypeScript типы
  ui/          — UI-компоненты (обёртки над Naive UI)
  icons/       — иконки
  styles/      — design tokens, миксины медиа-запросов
  kb/          — структура и markdown-контент KB
supabase/
  migrations/  — SQL-миграции
  functions/   — Edge Functions (Deno)
```

## Key Technical Decisions
- **SPA для admin** — нет SSR, быстрый dev, нет проблем с авторизацией
- **SSR для storefront** — SEO, быстрый first paint
- **Supabase Realtime** — каналы для заказов, кухни, столов без polling
- **RLS на уровне БД** — безопасность через SQL, не через код
- **Модульность** — TenantModules включает/выключает разделы (orders, kitchen, tables, reservations, promotions)
- **@fastio/kb** — отдельный пакет для контента KB, используется и в help-приложении, и в AI-ассистенте admin

## Design Patterns
- `useRealtimeList` — универсальный оркестратор для списков с Supabase Realtime
- `useRealtimeWatch` — то же для одного объекта
- `useDatabase()` — агрегатор всех API-модулей, единая точка входа
- `usePermissions()` — composable для проверки прав в компонентах
- `moduleToggleChecks.ts` — проверка зависимостей перед отключением модуля

## Component Relationships
- Для card-like блоков → `<UiCard>`
- Для типографики → `<UiText>` / `<UiTitle>`, не `<p>`/`<h*>`
- Медиа-запросы → `@use '@fastio/styles/mixins/media-queries' as mq`

## Multi-tenant Pattern
- Таблицы: `tenant_members`, `tenant_invitations`
- SQL helpers: `is_tenant_member()`, `has_tenant_role()`
- Store: `useTenantStore()` — текущий тенант + роль + `switchTenant()`
- Роли: owner > admin > manager > staff (enum `tenant_role`)

## tenant vs maybeTenant
`useTenantStore()` экспортирует **два** ref'а на тенант — выбор зависит от роута:

- **`tenant`** (non-nullable, default) — на защищённых роутах. Гарантирован `auth.global.ts` middleware'ом после `init()`. Используй везде в `pages/`, `components/`, `composables/`. В dev-режиме чтение до загрузки кидает ошибку с понятным текстом, в проде — TypeError на доступе к полю.
- **`maybeTenant`** (nullable) — только для:
  - `app.vue` (рендерится на login/legal/* без tenant);
  - `middleware/auth.global.ts` (проверяет, нужен ли init);
  - публичных страниц с `definePageMeta({ layout: false })`: `login`, `invite`, `set-password`, `no-access`, `legal/*`.

Готовые computed-shortcuts в сторе: `tenantId`, `timezone`, `businessType` — предпочитай их вместо `tenant.value.id` и т.п. (короче, и `timezone` фолбэчит на `DEFAULT_TIMEZONE`).

Все magic strings `'Europe/Moscow'` → `DEFAULT_TIMEZONE` из `@fastio/shared`.
