# Fastio

Мультитенантная SaaS-платформа для ресторанов быстрого питания. Каждый ресторан получает собственную витрину (по поддомену или кастомному домену) и панель администратора для управления меню, заказами и настройками.

---

## Структура монорепо

```
fastio/
├── apps/
│   ├── admin/        — Nuxt 3, панель администратора (SPA, SSR off)
│   └── storefront/   — Nuxt 3, витрина покупателя (SSR on)
├── packages/
│   ├── shared/       — Общие TypeScript типы (@fastio/shared)
│   └── ui/           — UI-библиотека (@fastio/ui)
├── supabase/
│   ├── migrations/   — SQL миграции (схема, индексы, RLS, realtime)
│   └── functions/    — Supabase Edge Functions (Deno)
└── scripts/
    └── create-tenant.mjs  — CLI для создания нового тенанта
```

Монорепо управляется через **pnpm workspaces** + **Turborepo**.

---

## Стек

| Слой | Технологии |
|---|---|
| Frontend | Nuxt 3, Vue 3, Pinia v3 (setup API), VueUse |
| Backend | Supabase: PostgreSQL, Auth, Realtime, Edge Functions |
| Email | SendGrid (через Edge Function) |
| Платежи | ЮKassa (вебхук → Edge Function) |
| Деплой | Vercel (admin + storefront), Supabase CLI (migrations + functions) |
| Инструменты | pnpm 9, Turborepo 2, TypeScript 5, ESLint |

---

## Приложения

### `apps/admin` — Панель администратора

- **SSR: выключен** (чистый SPA)
- Аутентификация через Supabase Auth
- Работает только для авторизованных владельцев ресторанов
- Realtime подписки на изменения данных через Supabase channels

**Страницы:**
- `/login` — вход
- `/` (index) — дашборд
- `/menu` — управление категориями и блюдами
- `/orders` — список и статусы заказов
- `/promotions` — акции и промокоды
- `/settings` — настройки ресторана (контакты, часы работы, тема, уведомления)

**Stores:**
- `auth.ts` — текущий Supabase User
- `tenant.ts` — данные тенанта текущего владельца (fetch + realtime channel)

**Composables:**
- `useCategories(tenantId: Ref<string>)` — CRUD + realtime подписка
- `useDishes(tenantId: Ref<string>)` — CRUD + realtime подписка
- `useOrders(tenantId: Ref<string>)` — realtime подписка на заказы

---

### `apps/storefront` — Витрина покупателя

- **SSR: включён**
- Тенант определяется на сервере по hostname (кастомный домен или поддомен `slug.platform.com`)
- Данные меню/тенанта загружаются через Nuxt server API (Supabase с `service_role` ключом)
- Корзина хранится в `localStorage`

**Страницы:**
- `/` — главная (меню)
- `/cart` — корзина
- `/order/[id]` — страница заказа (статус)

**Server middleware:**
- `tenant.ts` — резолвит тенанта по hostname, кладёт `tenant` в `event.context`

**Server API:**
- `GET /api/tenant` — данные тенанта
- `GET /api/menu` — категории + блюда
- `POST /api/orders` — создание заказа
- `GET /api/orders/[id]` — статус заказа

**Stores:**
- `cart.ts` — корзина (items, count, subtotal, persist/restore в localStorage)

---

### `supabase/functions` — Edge Functions

- **`send-order-email`** — Database Webhook при INSERT в `orders` → отправляет email через SendGrid на адрес из `tenant.notifications.email`
- **`payment-webhook`** — HTTP endpoint для вебхука ЮKassa → при `payment.succeeded` обновляет `subscription.status = 'active'` у тенанта
- **`add-custom-domain`** — JWT-protected endpoint → добавляет домен в Vercel проект через Vercel API + сохраняет в таблицу `tenants`

---

### `packages/shared` — Общие типы

Пакет `@fastio/shared`, экспортирует TypeScript типы:

- **`tenant.ts`** — `Tenant`, `TenantTheme`, `TenantContacts`, `TenantWorkingHours`, `TenantNotifications`, `TenantSubscription`
- **`menu.ts`** — `Category`, `Dish`, `DishTag`, `DishNutrition`, `DishIngredient`
- **`order.ts`** — `Order`, `OrderItem`, `OrderCustomer`, `OrderStatus`, `OrderDeliveryType`
- **`promotion.ts`** — `Promotion`, `PromoCode`, `DiscountType`

---

## Модель данных (PostgreSQL)

```sql
tenants       — тенанты (owner_id → auth.users)
categories    — категории меню (tenant_id FK)
dishes        — блюда (tenant_id FK, category_id FK)
orders        — заказы (tenant_id FK)
promotions    — акции (tenant_id FK)
promo_codes   — промокоды (tenant_id FK)
```

**RLS политики:**
- `tenants`: только владелец (по `owner_id = auth.uid()`)
- `categories`, `dishes`, `promotions`, `promo_codes`: читать публично, писать — только владелец
- `orders`: создавать может кто угодно (анонимный покупатель), читать/обновлять — только владелец

---

## Мультитенантность

Тенант определяется по hostname:
1. Сначала ищется по `custom_domain` (полное совпадение)
2. Затем по `slug` из поддомена (`slug.platform.com`)
3. Фолбэк: query-параметр `?slug=` (для разработки без домена)

Кастомный домен добавляется через Edge Function `add-custom-domain`, которая регистрирует домен в Vercel через API.

Подписка: `trial` (14 дней) → `active` (через ЮKassa) → `suspended` / `cancelled`.

---

## Локальная разработка

```bash
# Установка зависимостей
pnpm install

# Запустить локальный Supabase (Docker Desktop должен быть запущен)
pnpm supabase:start

# Запуск всего сразу (admin + storefront)
pnpm dev

# Или по отдельности
pnpm dev:admin
pnpm dev:storefront

# Supabase Studio (UI для БД)
pnpm supabase:studio

# Создание нового тенанта (локально)
pnpm create-tenant --name "Пицца Васи" --slug vasya-pizza --email owner@example.com --password secret123

# Создание тенанта на remote Supabase
pnpm create-tenant:remote --name "Пицца Васи" --slug vasya-pizza --email owner@example.com
```

**Переменные окружения admin** (`apps/admin/.env`):
```
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Переменные окружения storefront** (`apps/storefront/.env`):
```
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NUXT_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Для локальной разработки создай `.env.local` в каждом аппе с ключами от локального Supabase (`supabase start` выводит их в консоль).

---

## Деплой

### Vercel

`admin` и `storefront` деплоятся как отдельные Vercel-проекты.

```bash
pnpm build
```

### Supabase

```bash
# Применить миграции на прод
supabase db push

# Задеплоить Edge Functions
pnpm supabase:deploy:functions
```

**Переменные окружения Edge Functions** (Supabase Dashboard → Edge Functions → Secrets):
```
SENDGRID_KEY=SG.xxx
VERCEL_TOKEN=xxx
VERCEL_PROJECT_ID=prj_xxx
```

---

## Требования

- Node.js >= 20
- pnpm 9.15.0
- Docker Desktop (для локального Supabase)
