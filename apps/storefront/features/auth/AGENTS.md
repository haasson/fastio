# auth — заметка для агента

Аутентификация гостя storefront. Shared aggregator (используется и retail-flow, и services-flow).

## Что модуль делает

Поддерживает три способа логина:
1. **Email + password** (`AuthLoginModal` / `AuthRegisterModal`) — стандартный Supabase Auth.
2. **Telegram OAuth** (`AuthTelegramButton` / `AuthTelegramWidget`) — через бота `telegramAuthBotToken`. Гость жмёт кнопку → редирект на t.me → бот возвращает init_data → сервер валидирует HMAC → сессия Supabase.
3. **Восстановление пароля** (`AuthForgotPasswordModal` → email с ссылкой → `pages/reset-password.vue`).

`useAuthStore` хранит текущего `User` (Supabase user) + `customer` (наш доменный профиль с phone/name/email/telegram_id).

## Карта модуля

| Файл | Что внутри |
|---|---|
| `stores/auth.ts` | `useAuthStore` — текущий user, customer, методы login/logout/refresh + computed isAuthenticated |
| `components/AuthLoginModal.vue` | Модалка логина (email + password) + кнопка Telegram |
| `components/AuthRegisterModal.vue` | Модалка регистрации (email + password + имя) |
| `components/AuthForgotPasswordModal.vue` | Запрос ссылки на восстановление по email |
| `components/AuthTelegramButton.vue` | Кнопка «Войти через Telegram» (deep-link на бота) |
| `components/AuthTelegramWidget.vue` | Виджет Telegram Login Widget (альтернативный flow на десктопе) |

## Типовые задачи

- **Изменить логику hash-проверки telegram init_data:** правится в `apps/storefront/server/utils/telegramAuth.ts`, не здесь (клиент только UI).
- **Новый способ логина (VK ID, Яндекс ID):** добавь новый Modal-компонент + endpoint на сервере. Состояние в `useAuthStore` минимальное.
- **Поля профиля в регистрации:** правь `AuthRegisterModal.vue` + `/api/auth/register`.

## Антипаттерны (не делай так)

- ❌ Прямой `supabase.auth.signInWithPassword` из компонента — пиши через `useAuthStore.login()`, чтобы customer profile подгружался единообразно.
- ❌ Хранить пароль/токен в state. Supabase SDK сам управляет access/refresh tokens.
- ❌ Импорт `~/stores/auth` снаружи модуля (старый путь) — используй `~/features/auth`.
- ❌ Запускать `useAuthStore` ДО `app.vue` инициализации — в SSR Pinia ещё не готов, может крашнуть.

## Куда расти

- **Flash Call** (WISHLIST): SMS-логин через SMSC.ru, custom Supabase SMS hook — отдельный endpoint + новая модалка.
- **VK ID / Яндекс ID** (WISHLIST): OAuth2 flows — каждый = новая кнопка + серверный handler.
