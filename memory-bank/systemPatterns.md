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
- `usePermissions()` — composable для проверки прав в компонентах (низкоуровневый)
- `useGate()` — **единая точка проверки доступа к фичам**: возвращает `{enabled, reason}` где reason ∈ `{suspended, absent, flag, locked, disabled, unconfigured, forbidden, null}`. Учитывает 7 слоёв защиты: subscription status, plan, business type/menuStyle, module toggle, role permissions, tenant config, compile-time flags. Приоритет: suspended → absent → flag → locked → disabled → unconfigured → forbidden. Используй вместо ручного комбинирования permissions+modules.
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

## Storefront Customer Auth
На витрине **два независимых пути** аутентификации, которые объединяет `server/utils/customerAuth.ts`:

1. **Email/password** — поверх Supabase Auth. JWT/refresh токены живут в Supabase SDK (localStorage), refresh делает сам Supabase. На сервере проверяется через `supabase.auth.getUser()`.
2. **Telegram Login Widget** — **кастомная сессионная модель** (см. ADR ниже). Никакой Supabase auth не задействован — телеграм-юзер не имеет `auth_user_id` в таблице `customers`.

Таблица `customers` поддерживает оба пути: `auth_user_id` nullable, добавлен `telegram_id`.

### ADR: Sliding session vs Refresh-token pattern для Telegram-auth (2026-04-25)

**Решение:** Variant A — Sliding session (HttpOnly cookie + хеш токена в БД + продление `expires_at` при использовании).

**Реализация:**
- Серверная сессия в `customer_sessions`, токен `tgs_<32hex>` в БД хранится как SHA-256 хеш (колонка `token_hash`)
- Сам токен — в HttpOnly cookie `tg_session` (SameSite=Lax, Secure в prod, Path=/, Max-Age=30d)
- TTL: 30 дней. На каждый аутентифицированный запрос `expires_at` сдвигается на +30d, **но не чаще раза в сутки** (throttle через сравнение `expires_at - now() < 29d`), чтобы не насиловать БД
- Cleanup протухших — `pg_cron` job раз в сутки `DELETE FROM customer_sessions WHERE expires_at < now()`

**Почему A, а не B (refresh-token + JWT access):**
- Storefront-кастомер — это не банковский кабинет. Угон сессии в худшем случае = заказ еды на чужой адрес. Модель угроз не оправдывает 480 строк кода вместо 150.
- В системе УЖЕ есть Supabase refresh-machine для email-юзеров. Свой refresh-цикл для TG = две независимые системы, разное поведение, болезненная отладка.
- Storefront — SSR. Refresh-токены требуют прокидывания cookie + ротации **и** на серверном рендере, **и** на клиенте. Sliding session работает одинаково в обоих режимах.
- A закрывает 80% угроз (XSS не достанет HttpOnly cookie, утечка БД не даёт живых сессий из-за хеша) с минимумом сложности.

**Минус варианта A, который мы принимаем осознанно:**
- Если access-токен утёк (например, через прокси/MITM на HTTP-сегменте), он валиден до 30 дней. Нет короткого окна как с 15-мин JWT.
- Mitigation: Secure cookie (только HTTPS), серверный logout инвалидирует строку в БД немедленно, кнопка «Выйти на всех устройствах» в профиле (планируется).

**Когда мигрировать на B (refresh-token + JWT):**
- Появилось мобильное приложение или внешний API, где stateless JWT критичен для масштабирования
- На витрине появилась оплата прямо с сохранённой картой (CVV-less re-charge) или другие действия с финансовым ущербом > заказ еды
- Pen-test или security-инцидент показал реальную необходимость короткого access-окна
- Появилась многофакторка для кастомеров — refresh-pattern удобнее для step-up auth

До тех пор A — уместное решение, не дешёвый компромисс.
