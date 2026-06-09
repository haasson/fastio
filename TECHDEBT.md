# TECHDEBT

Технический долг проекта: заглушки, хаки, временные решения, мёртвый код.
Каждая запись = один абзац с названием и кратким «что/почему».

---

## module_configs.required_plan_key — имя врёт: хранит ТИР, а не ключ плана

`module_configs.required_plan_key` хранит **короткий тир** (`pro`/`start`), а не полный `plans.key` (`retail-pro`/`services-pro`). Так и должно быть: `module_configs` глобальная (12 строк, без `tenant_id`, с колонкой `business_types`) — одна строка модуля обслуживает и retail, и services, поэтому полный ключ плана туда положить нельзя. Но имя колонки `required_plan_key` вводит в заблуждение — выглядит как ключ плана.

Эта ловушка уже стрельнула: в `billing_change_plan` (ветка downgrade) guard модульных конфликтов джойнил `plans rp ON rp.key = mc.required_plan_key` — не матчилось (тир != полный ключ) → `rp.sort_order` NULL → проверка **никогда не срабатывала** (мёртвый guard, спасал только рантайм-`useGate`). Починено в `319_billing_change_plan_fix_module_guard.sql` и `318_billing_activate_plan.sql` через мост `rp.key = v_tenant.business_type || '-' || mc.required_plan_key`. Guard теперь реально блокирует даунгрейд при включённых премиум-модулях (проверено).

Остаточный долг (не критично, rename сознательно отложен): переименовать колонку `required_plan_key` → `required_tier`, чтобы следующий агент не принял её за ключ плана. Это rename + миграция + правка всех ссылок (две billing-функции + любые чтения в коде). Допущения текущего моста: (1) формат `plans.key` остаётся `{business_type}-{tier}`; (2) `tenants.business_type` не NULL — иначе склейка даёт NULL, JOIN не матчится и guard молча пропускает (по доменному инварианту тенант всегда retail XOR services, так что для тенанта с планом business_type заполнен). Если что-то из этого изменится — мост сломается тихо.

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
