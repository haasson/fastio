# Active Context: Fastio

## Current Work Focus
Реализован Telegram Login Widget для storefront-кастомеров (2026-04-25): второй путь авторизации параллельно с email/password. Использует sliding session на HttpOnly cookie (см. ADR в systemPatterns.md).

## Recent Changes
- **Telegram auth для storefront** (2026-04-25): добавлен Telegram Login Widget. Sliding-session модель (HttpOnly cookie, SHA-256 хеш токена в БД, продление TTL при использовании, pg_cron cleanup). Решение и обоснование выбора A vs B — в `systemPatterns.md` → ADR.
- **Route-level гейтинг** (2026-04-25): добавлен `middleware/gate.global.ts` + `composables/plan/useGate.routes.ts`. Закрывает прямой URL-доступ к секциям, которых юзер не видит в `AppNav` (выключенный модуль, нет прав, locked план). Карта роут → `GateKey` совпадает с видимостью в навигации. Suspended-флоу остаётся за `auth.global` (избегаем двойного редиректа). При отказе ищет первый доступный fallback из `REDIRECT_FALLBACKS` (`/`, `/orders`, …, `/account/profile`).
- **`useGate` система** (2026-04-25): новый composable `composables/plan/useGate.ts` с типами в `useGate.types.ts`, тесты в `__tests__/useGate.test.ts` (27 кейсов). Заменяет ручное комбинирование `usePermissions + useAccess + tenant.modules + tenant config`. Каждый гейт возвращает `{enabled, reason, requiredPlan?, configPath?, hint?}`. Приоритет причин: suspended → absent → flag → locked → disabled → unconfigured → forbidden. `useAccess.ts` удалён (не было ни одного потребителя).
- Хелпер `useGate.helpers.ts` — `toEnabled()` для конвертации в boolean
- Мигрированы: AppNav, orders/*, kitchen/*, menu/*, tables/*, reservations/settings, team, audit-log, settings/notifications, BannerFormModal, useBranchLimit, useKitchenStatusBlock
- Добавлен `apps/help/` — Nuxt SSR приложение (порт 4712)
- Добавлен `packages/kb/` — пакет с markdown-контентом и структурой KB
- В `apps/admin/server/ai/loadKnowledge.ts` — логика загрузки контента для AI-ассистента
- PhotoSwipe lightbox в gallery slider (storefront)
- Пиннинг categoryBar и hero в sections editor

## Next Steps
- Уточнить у пользователя текущий статус help-приложения
- Обновить этот файл после прояснения задач

## Active Decisions and Considerations
- `@fastio/kb` — единый источник правды для контента KB: используется и в help-приложении (рендер страниц), и в admin (AI-ассистент загружает kb-файлы через `loadKnowledge`)
- KB_ROUTES в `packages/kb/src/index.ts` маппит роуты admin → секции AI-знаний

## Important Patterns and Preferences
- Пользователь предпочитает неформальное общение, юмор, конкретику
- Всегда читать исходники компонентов @fastio/ui перед использованием
- Перед коммитом — обновлять KB-файлы в `packages/kb/content/*.md`
