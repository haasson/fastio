# TECHDEBT

Технический долг проекта: заглушки, хаки, временные решения, мёртвый код.
Каждая запись = один абзац с названием и кратким «что/почему».

---

## broadcastToTenantTelegram — rate-limit при >30 подписках

`apps/ops/server/utils/telegramBroadcast.ts` шлёт все сообщения параллельно через `Promise.allSettled`. Telegram global rate-limit — 30 msg/sec на бота. Если у тенанта >30 подписок и несколько событий прилетают одновременно (бронь + запись + вызов), словим 429.

Pre-existing pattern. Что нужно: переключиться на батчи с задержкой (~25 msg/500ms) либо очередь через pg_boss + worker. Актуально когда у тенанта появятся крупные команды.

---

## glitchtip-alert.post.ts — не мигрирован в apps/ops/ (фаза 04.1)

Хендлер `apps/admin/server/api/telegram/glitchtip-alert.post.ts` остался в admin, потому что URL для GlitchTip webhook alert настраивается вручную в GlitchTip UI (errors.fastio.ru → Project Settings → Alerts → Slack-compatible webhook). Фаза 04.1 не включала обновление этой конфигурации.

Что нужно сделать:
1. Скопировать `apps/admin/server/api/telegram/glitchtip-alert.post.ts` в `apps/ops/server/api/telegram/glitchtip-alert.post.ts` (тот же паттерн копирования утилит и нотифай-хендлеров из фазы 04.1, Wave 2).
2. В GlitchTip UI обновить webhook URL: `https://admin.fastio.ru/api/telegram/glitchtip-alert` → `https://ops.fastio.ru/api/telegram/glitchtip-alert`.
3. Триггернуть тестовую ошибку в GlitchTip (или дождаться реального alert'а), проверить доставку в Telegram-канал.
4. Удалить `apps/admin/server/api/telegram/glitchtip-alert.post.ts`.

Почему не сделали сразу: GlitchTip конфиг живёт вне репозитория (UI-state), и совмещение его правки с массовой миграцией хендлеров увеличивало бы blast radius фазы 04.1. Архитектурно glitchtip-alert принадлежит ops (ops_bot_token + alert_chat_id), поэтому это технический долг, а не дизайн-решение.

Связано: фаза 04.1 (INFRA-01), RESEARCH Open Question 1.
