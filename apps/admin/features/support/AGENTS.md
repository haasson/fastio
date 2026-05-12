# support — заметка для агента

Поддержка: тикеты и чат с командой FastIO (shared). Полная мета — `feature.manifest.ts`.

## Что модуль делает

Тикет = `support_tickets` (статус, тема). Сообщения = `support_messages` (двусторонний чат). Со стороны тенанта — фронт. Со стороны команды FastIO — `apps/backoffice`. Realtime — оба видят сообщения мгновенно.

## Карта модуля

| Файл | Что внутри |
|---|---|
| `api/support.ts` | CRUD тикетов и сообщений + смена статуса |
| `composables/useSupportChannel.ts` | **Глобальный канал. Один раз в layout.** Подписка на новые сообщения |
| `composables/useUnreadSupportCounter.ts` | Бейдж непрочитанных в навигации |
| `components/*` | Виджеты тикета и чата (cross-module — открываются из support-кнопки в layout) |

## Типовые задачи

- **Новый статус тикета:** enum в `support_tickets.status` + строка в `shared/utils/supportStatus.ts` (там лейблы и цвета — один источник).
- **Файлы в сообщении:** есть поле `attachments` (jsonb), загрузка — через Supabase Storage bucket `support`.
- **Уведомление о новом сообщении:** для тенанта — `useSupportChannel` (in-app). Для команды — Edge Function `notify-support-team` (см. supabase/functions).

## Антипаттерны (не делай так)

- ❌ Хардкодить лейбл/цвет статуса в компоненте — это `shared/utils/supportStatus.ts`.
- ❌ Создавать второй realtime канал — он один.
- ❌ Менять статус из `apps/admin` напрямую `update support_tickets.status` — у RLS правил, что админ-сторона может только `closed` (а `in_progress`/`waiting_admin` ставит backoffice).

## Куда расти

Knowledge-base ссылки в ответ — берутся из `@fastio/kb` через slug. Не хардкодить ссылки.
