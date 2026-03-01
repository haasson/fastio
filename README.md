# FastFood SaaS

Мультитенантная SaaS-платформа для ресторанов быстрого питания. Каждый ресторан получает собственную витрину (по поддомену или кастомному домену) и панель администратора для управления меню, заказами и настройками.

---

## Структура монорепо

```
fastfood-saas/
├── apps/
│   ├── admin/        — Nuxt 3, панель администратора (SPA, SSR off)
│   ├── storefront/   — Nuxt 3, витрина покупателя (SSR on)
│   └── functions/    — Firebase Cloud Functions (Node 20)
├── packages/
│   └── shared/       — Общие TypeScript типы (@fastfood-saas/shared)
├── scripts/
│   └── create-tenant.mjs  — CLI для создания нового тенанта
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
└── firebase.json
```

Монорепо управляется через **pnpm workspaces** + **Turborepo**.

---

## Стек

| Слой | Технологии |
|---|---|
| Frontend | Nuxt 3, Vue 3, Pinia v3 (setup API), VueUse |
| Backend | Firebase: Firestore, Auth, Storage, Cloud Functions v1 |
| Email | SendGrid (`@sendgrid/mail`) |
| Платежи | ЮKassa (вебхук) |
| Деплой | Vercel (admin + storefront), Firebase (functions + rules) |
| Инструменты | pnpm 9, Turborepo 2, TypeScript 5, ESLint |

---

## Приложения

### `apps/admin` — Панель администратора

- **SSR: выключен** (чистый SPA)
- Аутентификация через Firebase Auth
- Работает только для авторизованных владельцев ресторанов
- Подключается к Firestore напрямую через клиентский SDK

**Страницы:**
- `/login` — вход
- `/` (index) — дашборд
- `/menu` — управление категориями и блюдами
- `/orders` — список и статусы заказов
- `/promotions` — акции и промокоды
- `/settings` — настройки ресторана (контакты, часы работы, тема, уведомления)

**Stores:**
- `auth.ts` — текущий Firebase User
- `tenant.ts` — данные тенанта текущего владельца (realtime onSnapshot)

**Composables:**
- `useCategories(tenantId: Ref<string>)` — CRUD + realtime подписка
- `useDishes(tenantId: Ref<string>)` — CRUD + realtime подписка
- `useOrders(tenantId: Ref<string>)` — realtime подписка на заказы

---

### `apps/storefront` — Витрина покупателя

- **SSR: включён**
- Тенант определяется на сервере по hostname (кастомный домен или поддомен `slug.platform.com`)
- Данные меню/тенанта загружаются через Nuxt server API (firebase-admin)
- Корзина хранится в `localStorage`

**Страницы:**
- `/` — главная (меню)
- `/cart` — корзина
- `/order/[id]` — страница заказа (статус)

**Server middleware:**
- `tenant.ts` — резолвит тенанта по hostname, кладёт `tenantId` и `tenant` в `event.context`

**Server API:**
- `GET /api/tenant` — данные тенанта
- `GET /api/menu` — категории + блюда
- `POST /api/orders` — создание заказа
- `GET /api/orders/[id]` — статус заказа

**Stores:**
- `cart.ts` — корзина (items, count, subtotal, persist/restore в localStorage)

---

### `apps/functions` — Cloud Functions

- **`onOrderCreated`** — Firestore trigger при создании заказа → отправляет email через SendGrid на адрес из `tenant.notifications.email`
- **`onPaymentWebhook`** — HTTP endpoint для вебхука ЮKassa → при `payment.succeeded` обновляет `subscription.status = 'active'` у тенанта
- **`addCustomDomain`** — Callable function → добавляет домен в Vercel проект через Vercel API + сохраняет в Firestore

---

### `packages/shared` — Общие типы

Пакет `@fastfood-saas/shared`, экспортирует TypeScript типы:

- **`tenant.ts`** — `Tenant`, `TenantTheme`, `TenantContacts`, `TenantWorkingHours`, `TenantNotifications`, `TenantSubscription`
- **`menu.ts`** — `Category`, `Dish`, `DishTag`, `DishNutrition`, `DishIngredient`
- **`order.ts`** — `Order`, `OrderItem`, `OrderCustomer`, `OrderStatus`, `OrderDeliveryType`
- **`promotion.ts`** — `Promotion`, `PromoCode`, `DiscountType`

---

## Модель данных Firestore

```
/tenants/{tenantId}
  ├── name, slug, customDomain, ownerId
  ├── theme { primaryColor, fontFamily, logoUrl, bannerUrl, preset }
  ├── contacts { phone, email, address, city, instagram, vk }
  ├── workingHours { mon..sun: { open, close, closed } }
  ├── notifications { email, telegramChatId }
  ├── subscription { status, plan, trialEndsAt, renewsAt }
  ├── deliveryMinOrder, deliveryFee, createdAt
  │
  ├── /categories/{categoryId}
  │     └── tenantId, name, order, active
  │
  ├── /dishes/{dishId}
  │     └── tenantId, categoryId, name, description, price,
  │         photos[], ingredients[], nutrition, tags[], active, order
  │
  ├── /orders/{orderId}
  │     └── tenantId, customer, items[], deliveryType, address,
  │         comment, promoCode, discountAmount, subtotal,
  │         deliveryFee, total, status, paymentType, createdAt
  │
  ├── /promotions/{promotionId}
  │     └── tenantId, title, description, bannerUrl,
  │         discountType, discountValue, activeFrom, activeTo, active
  │
  └── /promoCodes/{codeId}
        └── tenantId, code, discountType, discountValue,
            usageLimit, usedCount, activeFrom, activeTo, active
```

---

## Правила Firestore

- **Тенант**: только владелец (по `ownerId`)
- **Категории, блюда, акции, промокоды**: читать публично, писать — только владелец
- **Заказы**: создавать может кто угодно (покупатель), читать/обновлять — только владелец

---

## Мультитенантность

Тенант определяется по hostname:
1. Сначала ищется по `customDomain` (полное совпадение)
2. Затем по `slug` из поддомена (`slug.platform.com`)

Кастомный домен добавляется через callable function `addCustomDomain`, которая регистрирует домен в Vercel через API.

Подписка: `trial` (14 дней) → `active` (через ЮKassa) → `suspended` / `cancelled`.

---

## Локальная разработка

```bash
# Установка зависимостей
pnpm install

# Запуск admin
pnpm dev:admin

# Запуск storefront
pnpm dev:storefront

# Firebase эмуляторы (auth:9099, firestore:8080, storage:9199, functions:5001, ui:4000)
firebase emulators:start

# Создание нового тенанта
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json pnpm create-tenant \
  --name "Пицца Васи" \
  --slug vasya-pizza \
  --email owner@example.com \
  --password secret123
```

**Переменные окружения admin** (`.env`):
```
NUXT_PUBLIC_FIREBASE_API_KEY=
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NUXT_PUBLIC_FIREBASE_PROJECT_ID=
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NUXT_PUBLIC_FIREBASE_APP_ID=
```

**Переменные окружения storefront** (`.env`):
```
NUXT_PUBLIC_FIREBASE_API_KEY=
NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NUXT_PUBLIC_FIREBASE_PROJECT_ID=
NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NUXT_PUBLIC_FIREBASE_APP_ID=
NUXT_FIREBASE_ADMIN_CREDENTIALS_B64=   # base64 от service account JSON
```

---

## Деплой

### Vercel

`admin` и `storefront` деплоятся как отдельные Vercel-проекты.
Корневая директория каждого — соответствующая папка в `apps/`.

```bash
# Сборка всего
pnpm build
```

### Firebase

```bash
# Деплой правил и индексов Firestore + Storage
pnpm firebase:deploy:rules

# Деплой Cloud Functions
pnpm firebase:deploy:functions
```

**Переменные окружения functions** (файл `apps/functions/.env` или через Firebase Console → Functions → Environment variables):
```
SENDGRID_KEY=SG.xxx
VERCEL_TOKEN=xxx
VERCEL_PROJECT_ID=prj_xxx
```

> `functions.config()` удалена в firebase-functions v7 — используем `process.env`.

---

## Требования

- Node.js >= 20
- pnpm 9.15.0
