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

### ADR: Визит — независимая «коробка» со статусом-стадией (2026-05-01)

**Решение:** `appointment_groups` (визит) хранит только **стадию** жизненного цикла — `'request' | 'active' | 'cancelled'`. Состояние «закрыт» (все услуги done) не выражается в БД-статусе визита, а вычисляется UI-агрегатом из `appointments.status`. Per-service удаления — через soft-delete (`appointments.deleted_at`), отдельно от `cancelled` бизнес-статуса.

**Что значит «коробка»:**
- Визит = посещение клиентом в один бизнес-день, содержит 1+ услуг
- Статусы услуг (`new` / `confirmed` / `done` / `cancelled`) живут независимо от стадии визита
- Подтверждение/отмена/завершение **отдельной** услуги не меняет `visit.status`
- Только cancelAll переводит весь визит в `cancelled`

**UI-агрегат `aggregateStatus` (computed в JS):**
- `request` → визит-заявка, услуг ещё нет (`requested_services` jsonb)
- `pending` → есть хотя бы одна услуга `status='new'`, требует обработки
- `confirmed` → все non-cancelled услуги confirmed, никто ещё не done
- `done` → все non-cancelled услуги завершены (попадает в архив)
- `cancelled` → визит сам cancelled ИЛИ все услуги cancelled
- `mixed` → confirmed/done вперемешку с cancelled

Расчёт инкапсулирован в composable `useVisitAggregate(visit, appointments)` (для страницы визита) и функции `aggregateFromVisit(visit, statusCounts)` (для батч-агрегации в инбоксе).

**Soft-delete vs cancellation:**
- `appointments.deleted_at IS NOT NULL` = услуга **физически удалена** из визита (через «крестик» в редакторе). Скрыта из UI, остаётся для аудита и восстановления.
- `appointments.status='cancelled'` = **бизнес-отмена** в рамках `cancelAll` визита. Видна клиенту в ЛК как «вы отменили заказ на стрижку+маникюр».

Все queries (capacity-чек, поиск target-визита для move, агрегаты) фильтруют `WHERE deleted_at IS NULL`. Soft-deleted услуги не блокируют ресурс.

**Почему именно так, а не `done` отдельным статусом визита:**
- Визит может быть «частично завершён» в любой момент — одна услуга прошла, другие в процессе или ещё впереди. Один статус не описывает это правдиво.
- БД-status для визита = grain «в каком состоянии этот контейнер с точки зрения админ-флоу». UI-aggregate = grain «что показывать в инбоксе/архиве». Это разные вещи и не должны смешиваться.
- Денормализация `done` в БД-статус потребовала бы триггера на appointments который пересчитывает агрегат. Лишняя сложность ради того, что и так считается дёшево в JS на 5-10 услуг визита.

**Когда передумать:**
- Если в инбоксе будет 50k+ визитов и client-side фильтр станет медленным — денормализовать `aggregate_status` в materialized view или колонку с триггером.
- Если появятся бизнес-флоу опирающиеся на «визит закрыт» (например, лояльность начисляется по `done`) — поднять статус из UI-агрегата в БД-стадию.

Реализация: миграции 224-232. Связанные RPC: `move_visit_to_date` (атомарный перенос всех услуг), `split_visit_to_request` (вынос услуг в новый request-визит со soft-delete в исходном), `add_service_to_visit` (с проверкой `status='active'`), `convert_visit_request` (заявка → визит с appointments).
