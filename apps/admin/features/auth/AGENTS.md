# auth — заметка для агента

Дверь в админку: вход, инвайты, регистрация по приглашению, сброс пароля. Полная мета — в `feature.manifest.ts` рядом.

## Что модуль делает

Тонкая обёртка над `supabase.auth.*`. Сама проверка сессии и редиректы — в глобальных middleware (`auth.global.ts`, `gate.global.ts`), фича отвечает только за низкоуровневый API и страницы входа/инвайта/смены пароля.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/auth.ts` | `authApi`: `signIn`/`signUp`/`signOut`/`getSession`/`updateUser` — прямые вызовы `sb.auth.*` |
| `types.ts` | Пусто — типы User/Session тянутся из `@supabase/supabase-js` |
| `index.ts` | Барель, реэкспортит только `api/auth` |

Страницы (живут в `apps/admin/pages/`, **не** в фиче):
- `login.vue` — вход + magic-link «забыли пароль» через `sb.auth.resetPasswordForEmail`
- `invite.vue` — принимает `?token=`, дёргает `useDatabase().tenantInvites.peek()` и роутит на `/login` (если юзер уже есть) или `/set-password` (новый)
- `set-password.vue` — два режима: новый юзер по invite-токену (signUp + updateUser) и сброс пароля по recovery-сессии
- `no-access.vue`, `suspended.vue` — состояния без тенанта / с приостановленным тенантом

## Типовые задачи

- **Добавить OAuth-провайдер:** новый метод в `authApi` (`signInWithOAuth`), отдельная кнопка на `login.vue`. Редирект — на `/invite?token=...` если нужно склеить с приглашением.
- **Поменять флоу инвайта:** логика разруливания «есть ли уже user» — в `invite.vue`. Сам приём токена (`tenantInvites.peek`/`accept`) — в фиче `team`, не дублируй здесь.
- **Новый redirect:** правь глобальные middleware (`apps/admin/middleware/auth.global.ts`), а не страницы — иначе будет двойной редирект.

## Антипаттерны (не делай так)

- Дёргать `sb.auth.*` напрямую из других модулей — иди через `useDatabase().auth` (это и есть `authApi`).
- Класть в `auth/api` логику работы с `tenant_invites` или ролями — это `features/team`. `auth` знает только про `auth.users`.
- Делать редиректы по сессии внутри страниц `login.vue`/`invite.vue` руками — за это отвечают global middleware.
- Хранить токен инвайта в localStorage/store — он одноразовый, живёт только в `?token=` query.
