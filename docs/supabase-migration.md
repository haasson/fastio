# Миграция Firebase → Supabase

Статус: 🔄 В процессе
Создан: 2026-03-02

---

## Обзор

Полный переезд с Firebase (Firestore + Auth + Storage + Cloud Functions) на Supabase (PostgreSQL + Auth + Storage + Edge Functions).

**Прода нет** — миграция данных не требуется, только код.

---

## Фазы

- [x] Фаза 1 — Подготовка и настройка окружения
- [x] Фаза 2 — Схема БД и миграции
- [x] Фаза 3 — RLS политики (безопасность)
- [x] Фаза 4 — Auth
- [x] Фаза 5 — Admin: stores и composables
- [x] Фаза 6 — Storefront: серверные роуты
- [x] Фаза 7 — Cloud Functions → Edge Functions
- [x] Фаза 8 — Storage (не использовалось, пропущено)
- [x] Фаза 9 — Dev-окружение и скрипты
- [x] Фаза 10 — Финальный прогон и очистка

---

## Фаза 1 — Подготовка и настройка окружения

### 1.1 Установить Supabase CLI
- [x] `brew install supabase/tap/supabase`
- [x] Проверить: `supabase --version` → 2.75.0

### 1.2 Создать Supabase проект
- [x] Зайти на supabase.com → New project
- [x] Project ref: `fnfutanbnabaguylimvq`, URL: `https://fnfutanbnabaguylimvq.supabase.co`

### 1.3 Настроить локальный Supabase (Docker)
- [x] `supabase init` в корне проекта
- [x] `supabase start` — локальный стек поднят на `http://127.0.0.1:54321`
- [x] `supabase/.temp` и `supabase/functions/.secrets` добавлены в `.gitignore`
- [x] Студия доступна на `http://127.0.0.1:54323`

### 1.4 Установить Supabase SDK
- [x] `@supabase/supabase-js` установлен в `apps/admin` и `apps/storefront`
- [x] `@supabase/ssr` установлен в `apps/storefront`

### 1.5 Обновить dev-скрипт и env
- [x] `pnpm dev` — теперь только admin + storefront (supabase Docker живёт сам)
- [x] `pnpm supabase:start` / `supabase:stop` — отдельные скрипты
- [x] `.env` обновлены с Supabase ключами (remote)
- [x] `.env.local` созданы с локальными ключами для разработки
- [x] `.env.example` обновлены под Supabase

---

## Фаза 2 — Схема БД и миграции

Firestore subcollections → реляционные таблицы с `tenant_id`.

### 2.1 Спроектировать таблицы

```sql
-- Тенанты
tenants (
  id uuid PRIMARY KEY,
  owner_id uuid REFERENCES auth.users,
  slug text UNIQUE NOT NULL,
  custom_domain text,
  theme jsonb,           -- TenantTheme (цвета, логотип)
  contacts jsonb,        -- TenantContacts
  working_hours jsonb,   -- TenantWorkingHours
  notifications jsonb,   -- TenantNotifications
  subscription jsonb,    -- TenantSubscription
  delivery_min_order numeric,
  delivery_fee numeric,
  created_at timestamptz DEFAULT now()
)

-- Категории меню
categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants NOT NULL,
  name text NOT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

-- Блюда
dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants NOT NULL,
  category_id uuid REFERENCES categories,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text,
  tags text[],           -- DishTag[]
  nutrition jsonb,       -- DishNutrition
  ingredients jsonb,     -- DishIngredient[]
  is_available boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
)

-- Заказы
orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants NOT NULL,
  customer jsonb NOT NULL,   -- OrderCustomer
  items jsonb NOT NULL,      -- OrderItem[]
  status text NOT NULL,      -- OrderStatus
  delivery_type text,        -- OrderDeliveryType
  total numeric NOT NULL,
  promo_code text,
  discount numeric DEFAULT 0,
  comment text,
  created_at timestamptz DEFAULT now()
)

-- Акции
promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants NOT NULL,
  title text NOT NULL,
  description text,
  image_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
)

-- Промокоды
promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants NOT NULL,
  code text NOT NULL,
  discount_type text NOT NULL,  -- DiscountType
  discount_value numeric NOT NULL,
  is_active boolean DEFAULT true,
  usage_limit int,
  usage_count int DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
)
```

### 2.2 Написать SQL миграции
- [ ] `supabase/migrations/001_initial_schema.sql` — создать все таблицы
- [ ] `supabase/migrations/002_indexes.sql` — индексы по `tenant_id`, `slug`, `custom_domain`
- [ ] Применить локально: `supabase db reset`
- [ ] Применить на проде: `supabase db push`

---

## Фаза 3 — RLS политики

Мультитенантная изоляция: каждый владелец видит только свои данные.

### 3.1 Политики для tenants
- [ ] Читать: только свой тенант (`owner_id = auth.uid()`)
- [ ] Обновлять: только свой тенант

### 3.2 Политики для categories, dishes, promotions, promo_codes
- [ ] Читать: публично (для витрины)
- [ ] Писать/обновлять/удалять: только владелец тенанта

### 3.3 Политики для orders
- [ ] Создавать: все (анонимные покупатели)
- [ ] Читать/обновлять: только владелец тенанта

### 3.4 Написать и протестировать политики
- [ ] `supabase/migrations/003_rls.sql`
- [ ] Протестировать через Supabase Studio (локально)

---

## Фаза 4 — Auth

### 4.1 Admin — auth store (`stores/auth.ts`)
- [ ] Заменить Firebase Auth SDK на `@supabase/supabase-js`
- [ ] `signInWithEmailAndPassword` → `supabase.auth.signInWithPassword()`
- [ ] `signOut` → `supabase.auth.signOut()`
- [ ] `onAuthStateChanged` → `supabase.auth.onAuthStateChange()`
- [ ] Создать `plugins/supabase.client.ts` — инициализация клиента

### 4.2 Admin — middleware
- [ ] Обновить `middleware/auth.ts` — проверять сессию через Supabase
- [ ] Убедиться что редирект на `/login` работает

### 4.3 Storefront — анонимные заказы
- [ ] Покупатель не авторизован — заказы создаются без auth
- [ ] RLS разрешает INSERT в orders без авторизации ✓

---

## Фаза 5 — Admin: stores и composables

### 5.1 tenant store (`stores/tenant.ts`)
- [ ] Заменить `onSnapshot` на `supabase.from('tenants').select().eq('owner_id', userId)`
- [ ] Realtime подписка: `supabase.channel('tenant').on('postgres_changes', ...)`
- [ ] Методы update → `supabase.from('tenants').update(...).eq('id', tenantId)`

### 5.2 `composables/useCategories.ts`
- [ ] Список: `.from('categories').select().eq('tenant_id', tenantId).order('sort_order')`
- [ ] Realtime: `postgres_changes` на таблице categories
- [ ] CRUD: insert / update / delete через Supabase client

### 5.3 `composables/useDishes.ts`
- [ ] Аналогично useCategories
- [ ] Учесть фильтрацию по `category_id`

### 5.4 `composables/useOrders.ts`
- [ ] Список с фильтрами по статусу и дате
- [ ] Realtime подписка на новые заказы
- [ ] Обновление статуса заказа

---

## Фаза 6 — Storefront: серверные роуты

Заменить `firebase-admin` SDK на Supabase server client (с `service_role` ключом).

### 6.1 `server/utils/supabase.ts`
- [ ] Создать серверный клиент Supabase (замена `firebase-admin.ts`)

### 6.2 `server/middleware/tenant.ts`
- [ ] Резолвить тенанта по hostname:
  - сначала по `custom_domain`
  - потом по `slug` из поддомена
- [ ] `supabase.from('tenants').select().eq('slug', slug).single()`

### 6.3 `server/api/tenant.get.ts`
- [ ] Заменить Firestore запрос на Supabase

### 6.4 `server/api/menu.get.ts`
- [ ] Получить категории + блюда одним запросом через JOIN или два запроса

### 6.5 `server/api/orders.post.ts`
- [ ] INSERT в таблицу orders
- [ ] Вернуть созданный заказ

### 6.6 `server/api/orders/[id].get.ts`
- [ ] `.from('orders').select().eq('id', id).single()`

---

## Фаза 7 — Cloud Functions → Edge Functions

### 7.1 `onOrderCreated` → Database Webhook + Edge Function
- [ ] Создать Edge Function `send-order-email`
- [ ] В Supabase Dashboard: Database → Webhooks → на INSERT в `orders`
- [ ] Логика отправки через SendGrid — перенести 1:1

### 7.2 `onPaymentWebhook` → HTTP Edge Function
- [ ] Создать Edge Function `payment-webhook`
- [ ] Принимает POST от ЮKassa
- [ ] Обновляет `tenants.subscription` через Supabase client

### 7.3 `addCustomDomain` → HTTP Edge Function
- [ ] Создать Edge Function `add-custom-domain`
- [ ] Вызывает Vercel API
- [ ] Обновляет `tenants.custom_domain`

### 7.4 Деплой Edge Functions
- [ ] `supabase functions deploy send-order-email`
- [ ] `supabase functions deploy payment-webhook`
- [ ] `supabase functions deploy add-custom-domain`

---

## Фаза 8 — Storage

### 8.1 Создать бакеты в Supabase Storage
- [ ] `dish-images` — публичный
- [ ] `promotion-images` — публичный
- [ ] `tenant-logos` — публичный

### 8.2 Обновить загрузку файлов в Admin
- [ ] Найти все места с Firebase Storage (`uploadBytes`, `getDownloadURL`)
- [ ] Заменить на `supabase.storage.from('bucket').upload(...)`
- [ ] URL получать через `supabase.storage.from('bucket').getPublicUrl(...)`

---

## Фаза 9 — Dev-окружение и скрипты

### 9.1 Обновить env переменные

**Admin** (`.env`):
```
NUXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NUXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Storefront** (`.env`):
```
NUXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NUXT_PUBLIC_SUPABASE_ANON_KEY=...
NUXT_SUPABASE_SERVICE_ROLE_KEY=...
```

### 9.2 Обновить `scripts/create-tenant.mjs`
- [ ] Переписать на Supabase Admin API вместо firebase-admin
- [ ] Создаёт запись в `tenants` + пользователя в Supabase Auth

### 9.3 Обновить `pnpm dev`
- [ ] Заменить `pnpm emulators` (firebase) на `supabase start`
- [ ] Убедиться что всё стартует одной командой

### 9.4 Обновить `turbo.json`
- [ ] Убрать firebase-специфичные env vars из turbo pipeline если есть

---

## Фаза 10 — Финальный прогон и очистка

### 10.1 Сквозное тестирование
- [ ] Регистрация / логин в Admin
- [ ] Создание тенанта
- [ ] CRUD категорий и блюд
- [ ] Realtime — изменения отражаются без перезагрузки
- [ ] Витрина — резолв тенанта по slug
- [ ] Создание заказа из витрины
- [ ] Email при новом заказе
- [ ] Загрузка изображений

### 10.2 Очистка Firebase
- [x] Удалить `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- [x] Удалить `firestore-debug.log`
- [x] Удалить Firebase SDK из всех `package.json`
- [x] Удалить `apps/functions`
- [x] Удалить `service-account.json`
- [x] Убрать firebase env vars из всех `.env` файлов

### 10.3 Обновить документацию
- [x] `README.md` — обновить стек и dev-инструкции
- [x] `memory/MEMORY.md` — обновить архитектурные решения

---

## Справка

### Полезные команды Supabase CLI

```bash
supabase start          # запуск локального Supabase
supabase stop           # остановка
supabase db reset       # пересоздать БД с нуля (применить все миграции)
supabase db push        # применить миграции на прод
supabase migration new  # создать новую миграцию
supabase functions serve # локальный запуск edge functions
supabase studio         # открыть Supabase Studio (UI)
```

### Маппинг Firebase → Supabase

| Firebase | Supabase |
|----------|----------|
| Firestore `collection` | PostgreSQL таблица |
| Firestore `doc` | Строка в таблице |
| `onSnapshot` | `supabase.channel().on('postgres_changes', ...)` |
| Firebase Auth | Supabase Auth |
| Firebase Storage | Supabase Storage |
| Cloud Functions | Edge Functions (Deno) |
| Security Rules | Row Level Security (RLS) |
| Firebase Emulators | `supabase start` (Docker) |
| `firebase-admin` SDK | `service_role` ключ + `@supabase/supabase-js` |
