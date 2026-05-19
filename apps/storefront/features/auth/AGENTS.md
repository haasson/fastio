# auth — заметка для агента

Аутентификация гостя storefront. Shared aggregator (используется и retail-flow, и services-flow).

## Что модуль делает

**Единственный способ логина — Telegram** (через бота). Email/password удалён в PREPROD-099 ([[storefront-tg-only-auth]] в memory). Не предлагать возвращать.

Flow:
1. Гость жмёт «Войти» → открывается `AuthLoginModal` с кнопкой `AuthTelegramButton`.
2. Кнопка дёргает `POST /api/auth/telegram/init` → получает `nonce` + `botUsername`, открывает `https://t.me/<bot>?start=<nonce>` в новой вкладке.
3. Параллельно poll'ит `GET /api/auth/telegram/poll?nonce=<nonce>` каждые 2 сек (макс. 15 мин).
4. Когда бот возвращает init_data на webhook, сервер выставляет HttpOnly cookie `tg_session` (token_hash в БД `customer_sessions`) и помечает nonce как `ok`.
5. `AuthTelegramButton` ловит `status: 'ok'` → emit('done') → `useAuthStore.loginWithTelegram()` подтягивает customer через `/api/auth/me`.

`useAuthStore` хранит `customer` (наш доменный профиль с phone/name/email/telegram_id) + `authMode: 'tg' | null`.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `stores/auth.ts` | `useAuthStore` — customer, init, fetchProfile, loginWithTelegram, logout, updateProfile, showLogin |
| `components/AuthLoginModal.vue` | Модалка с одной TG-кнопкой + legal-compliance проверка |
| `components/AuthTelegramButton.vue` | Сама кнопка с polling-логикой 15-минутного TTL |

## Типовые задачи

- **Изменить логику hash-проверки telegram init_data:** правится в `apps/storefront/server/utils/telegramAuth.ts`, не здесь (клиент только UI).
- **Поменять текст / consent-note** в логин-модалке — `AuthLoginModal.vue`.
- **Поля профиля** редактируются на странице `/account/profile` через `PATCH /api/customer/profile`.

## Антипаттерны (не делай так)

- ❌ Возвращать email/password логин — это намеренно удалено, см. memory [[storefront-tg-only-auth]].
- ❌ Хранить token в state — Supabase SDK + HttpOnly cookie сами управляют сессией.
- ❌ Импорт `~/stores/auth` снаружи модуля (старый путь) — используй `~/features/auth`.
- ❌ Запускать `useAuthStore` ДО `app.vue` инициализации — в SSR Pinia ещё не готов, может крашнуть.

## Куда расти

- **VK ID / Яндекс ID** (WISHLIST): OAuth2 flows через Supabase Auth — каждый = новая кнопка в модалке + серверный handler. В `stores/auth.ts` ветка `authMode='supabase'` сейчас **dormant** (после PREPROD-099 достижима только для legacy-сессий, которые тут же signOut'ятся) — при добавлении OAuth-провайдера оживёт без переписывания.
- **Flash Call** (WISHLIST): SMS-логин через SMSC.ru, custom Supabase SMS hook.
