# Secrets rotation runbook

Операционная процедура для ротации всех секретов FastIO. Применяй при:

- **Плановой ротации** — раз в 90 дней (квартал). Поставь календарь.
- **Подозрении на компрометацию** — утечка в git/логах/Sentry, leaked в публичный канал, доступ к VPS у бывшего сотрудника.
- **Увольнении** — любого, у кого был доступ к Coolify / Supabase Studio / GitHub repo settings / VPS ssh.

Все секреты ниже задокументированы: где живут, чем читаются, как ротировать. Если на проде появился новый секрет — добавь его сюда в том же коммите.

---

## Карта секретов

| Секрет | Источник | Кто читает | Назначение |
|---|---|---|---|
| `telegram_internal_secret` | Supabase Vault | admin app (`NUXT_INTERNAL_API_SECRET`) | Подпись внутренних DB-trigger → Nuxt webhook'ов (`x-internal-secret`) |
| `telegram_notify_url` | Supabase Vault | DB-триггер `notify_new_order_telegram` | URL `https://admin.fastio.ru/api/telegram/notify` |
| `telegram_notify_reservation_url` | Supabase Vault | DB-триггер `notify_new_reservation_telegram` | URL для уведомлений о бронированиях |
| `telegram_alert_url` | Supabase Vault | DB-функция `monitor_edge_errors()` | URL `https://admin.fastio.ru/api/telegram/notify-alert` |
| `appointment_reminder_url` | Supabase Vault | pg_cron `send-appointment-reminders` | URL `https://admin.fastio.ru/api/telegram/send-appointment-reminders` |
| `reminder_cron_secret` | Supabase Vault | admin (`NUXT_REMINDER_CRON_SECRET`) | Подпись cron→admin (`x-reminder-cron-secret`) |
| `NUXT_TELEGRAM_WEBHOOK_SECRET` | Coolify env (admin) | admin (`requireTelegramWebhookSecret`) | Подпись Telegram → admin webhook'ов (`x-telegram-bot-api-secret-token`) |
| `NUXT_TELEGRAM_BOT_TOKEN` / `NUXT_TELEGRAM_TENANT_BOT_TOKEN` | Coolify env (admin) | admin (`/api/telegram/notify`, `/webhook`) | Tenant-уведомления, заказы/брони |
| `NUXT_TELEGRAM_CLIENT_BOT_TOKEN` / `NUXT_TELEGRAM_AUTH_BOT_TOKEN` | Coolify env (admin + storefront) | admin (`/api/telegram/auth-webhook`, reminders), storefront (`/api/appointments/remind-offer`) | Сторфронт-логин кастомеров |
| `NUXT_TELEGRAM_OPS_BOT_TOKEN` | Coolify env (admin) | admin (`/api/telegram/notify-alert`) | Алёрты в админский канал |
| `NUXT_TELEGRAM_ALERT_CHAT_ID` | Coolify env (admin) | admin | chat_id админ-канала (намеренно НЕ в Vault — см. миграцию 278) |
| `NUXT_SUPABASE_SERVICE_ROLE_KEY` | Coolify env (admin + storefront + landing) | сервер-сайд везде | Bypass RLS — самый опасный секрет |
| `NUXT_PUBLIC_SUPABASE_ANON_KEY` | Coolify env (public) | admin/storefront клиент | Публичный — низкая чувствительность, но всё равно ротируется |
| `OPENAI_API_KEY` | Coolify env (admin) | admin (`/api/ai/chat`) | AI-ассистент |
| `NUXT_DADATA_API_KEY` | Coolify env (admin + storefront) | DaData suggestions | Подсказки адресов |
| `NUXT_PUBLIC_YANDEX_MAPS_API_KEY` | Coolify env (public) | admin/storefront клиент | Карты |
| `YOOKASSA_WEBHOOK_SECRET` | Edge-function secret (Supabase Functions secrets) | edge `payment-webhook` | Подпись ЮKassa webhook |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_HOST` | Edge-function secret | edge `send-new-tenant-email`, `send-recovery-email` | Timeweb SMTP |
| `COOLIFY_TOKEN` | Edge-function secret | edge `add-custom-domain` | Coolify API для добавления доменов тенантов |
| `FASTIO_INTERNAL_TOKEN` | Edge-function secret | edge `add-custom-domain` | Внутренняя авторизация |
| `SENTRY_DSN` (admin/storefront/edge) | Coolify env + edge-function secret | везде | Sentry ingestion — не критично, но ротируется при компрометации проекта |
| GitHub Actions: `VPS_SSH_KEY`, `VPS_HOST`, `TELEGRAM_OPS_BOT_TOKEN`, `TELEGRAM_OPS_CHAT_ID` | GitHub repo secrets | `.github/workflows/{migrate,deploy-functions,e2e-nightly}.yml` | Деплой миграций / edge functions, e2e алёрты |

---

## Общие принципы

1. **Никогда не ротируй два связанных секрета одновременно.** Сначала добавь новый, дождись rollout, потом удали старый. Иначе сломаешь прод между шагами.
2. **Всегда генерируй секреты криптостойким RNG.** Команды ниже используют `openssl rand` / `gen_random_bytes` — не выдумывай свои.
3. **После каждой ротации проверь Sentry за 30 мин.** Если посыпались 403/500 — откати (раздел «Откат»).
4. **Записывай дату ротации.** Веди журнал в Coolify Notes или в private GitHub issue с лейблом `secrets-rotation`.

---

## Ротация Vault-секретов (Supabase)

### `telegram_internal_secret` (signing key)

Используется в паре с `NUXT_INTERNAL_API_SECRET` (env admin'а). Они **должны совпадать** — иначе DB-триггеры начнут получать 403 от admin'а.

Стратегия: **dual-secret transition**. Admin временно принимает старый ИЛИ новый секрет, потом старый удаляется.

```bash
# 1. Сгенерируй новый секрет (32 байта hex = 64 символа)
NEW_SECRET=$(openssl rand -hex 32)
echo "NEW_SECRET=$NEW_SECRET"   # сохрани в менеджер паролей до конца процедуры

# 2. SSH на VPS, открой Supabase Studio (http://localhost:54323) ИЛИ psql напрямую
ssh root@<VPS_HOST>
docker exec -it supabase-db-<uuid> psql -U postgres -d postgres

# 3. Обнови секрет в Vault
SELECT vault.update_secret(id, '<NEW_SECRET>')
FROM vault.secrets WHERE name = 'telegram_internal_secret';

# 4. Добавь NEW_SECRET в Coolify env admin'а ВТОРЫМ слотом:
#    NUXT_INTERNAL_API_SECRET=<NEW_SECRET>
#    NUXT_INTERNAL_API_SECRET_PREV=<OLD_SECRET>   # ВАЖНО: код пока не поддерживает,
#    значит требуется обновление requireInternalSecret() в apps/admin/server/utils/auth.ts
#    чтобы принимать оба. Если ротация плановая — закоммить поддержку заранее.
#    Если экстренная — пропусти этот шаг и переходи к 5, готовясь к 30s downtime
#    DB-триггеров (заказы/брони — уведомления не дойдут до tenant'а).

# 5. Coolify → admin → Redeploy. Дождись «Deployment successful» (~1-2 мин).

# 6. Verify: создай тестовый заказ или дёрни вручную
docker exec -it supabase-db-<uuid> psql -U postgres -d postgres -c \
  "SELECT net.http_post(
     url := 'https://admin.fastio.ru/api/telegram/notify',
     body := '{\"orderId\":\"test\",\"tenantId\":\"test\"}'::jsonb,
     headers := jsonb_build_object('x-internal-secret', '$NEW_SECRET')
   );"
# Затем проверь в Coolify logs admin'а — должен быть 403 (test-данные) НЕ 500.

# 7. Через 24ч удали NUXT_INTERNAL_API_SECRET_PREV из Coolify → Redeploy.
```

### `telegram_alert_url`, `telegram_notify_url`, `telegram_notify_reservation_url`, `appointment_reminder_url`

URL'ы, не секреты в крипто-смысле. Ротировать НЕ нужно — менять только при смене домена admin'а. Команда:

```sql
SELECT vault.update_secret(id, 'https://new-admin.fastio.ru/api/telegram/notify')
FROM vault.secrets WHERE name = 'telegram_notify_url';
```

### `reminder_cron_secret`

Аналогично `telegram_internal_secret`, но проверяется в `apps/admin/server/api/telegram/send-appointment-reminders.post.ts` через header `x-reminder-cron-secret`. Стратегия и шаги — те же.

---

## Ротация Coolify env-секретов (admin / storefront / landing)

### `NUXT_TELEGRAM_WEBHOOK_SECRET`

Совместный секрет Telegram ↔ admin. При ротации Telegram должен узнать новый secret до того, как admin начнёт его требовать.

```bash
# 1. Сгенерируй
NEW=$(openssl rand -hex 32)

# 2. Coolify → admin → Environment Variables → NUXT_TELEGRAM_WEBHOOK_SECRET = <NEW>
# 3. Redeploy admin'а. Плагин telegram-bot-setup.ts в boot переустановит webhook через
#    setWebhook(..., secret_token=<NEW>). Telegram запомнит новый secret.
# 4. Verify: написать боту любое сообщение → проверить в Coolify logs admin'а
#    что запрос НЕ 403. Если 403 — Telegram не подхватил, дёрни вручную:
curl "https://api.telegram.org/bot$TOKEN/setWebhook?url=https://admin.fastio.ru/api/telegram/webhook&secret_token=$NEW"
```

### `NUXT_TELEGRAM_*_BOT_TOKEN` (4 бота)

Bot tokens — ротация только через BotFather:

```
1. https://t.me/BotFather → /token → выбери бота → подтверди revoke предыдущего
2. BotFather выдаст новый токен (старый умрёт мгновенно — здесь dual-secret НЕ работает)
3. Coolify → admin/storefront → обнови env → Redeploy
4. Verify: telegram-bot-setup.ts в boot прогонит setWebhook с новым токеном.
   Тест: /start в боте → бот ответил.
```

Окно недоступности: 1-3 минуты (старый токен умер, новый ещё не задеплоен). Делать в low-traffic время.

### `NUXT_SUPABASE_SERVICE_ROLE_KEY` — самый опасный

Если этот ключ утёк — RLS обходится, любой может читать/писать любые данные.

```bash
# 1. Supabase Studio → Project Settings → API → Reset service_role secret
#    ИЛИ через CLI на self-hosted: regenerate JWT, см. supabase-self-hosted docs.
#    Старый ключ умирает мгновенно.

# 2. ОДНОВРЕМЕННО обнови во всех Coolify-приложениях:
#    - admin
#    - storefront
#    - landing
#    - backoffice
#    Coolify не даёт «atomic update across services» → жми Redeploy на каждом
#    максимально быстро.

# 3. Проверь Sentry: должен быть burst 401 (старый ключ умер) → потом тишина.
#    Если 401 продолжается — ты забыл какое-то приложение.

# 4. Также обнови SUPABASE_SERVICE_ROLE_KEY в edge-functions secrets:
ssh root@<VPS_HOST>
docker exec supabase-edge-functions-<uuid> sh -c \
  'echo "SUPABASE_SERVICE_ROLE_KEY=<NEW>" >> /home/deno/functions/.env'
docker restart supabase-edge-functions-<uuid>
```

### `OPENAI_API_KEY`, `NUXT_DADATA_API_KEY`, `NUXT_PUBLIC_YANDEX_MAPS_API_KEY`

Сторонние ключи — ротируй через консоль провайдера (OpenAI / DaData / Yandex Console), потом обнови Coolify env и Redeploy. Для Yandex Maps учитывай что ключ публичный (NUXT_PUBLIC_) — стоит привязка к домену в Yandex Console.

---

## Ротация edge-function secrets (Supabase Functions)

Хранятся в `supabase/functions/.secrets` на VPS (Coolify volume `volumes/functions/`).

```bash
ssh root@<VPS_HOST>
cd /data/coolify/services/sox6wn6mth1wotz1yomzwh5i/volumes/functions/

# Покажи текущие
cat .secrets

# Обнови нужный ключ (vim / nano / sed)
vim .secrets

# Перезапусти контейнер
docker restart supabase-edge-functions-sox6wn6mth1wotz1yomzwh5i

# Verify: вызови соответствующую функцию (payment webhook test через Postman / curl)
```

Затронутые секреты: `YOOKASSA_WEBHOOK_SECRET`, `SMTP_USER`, `SMTP_PASS`, `COOLIFY_TOKEN`, `FASTIO_INTERNAL_TOKEN`, `SENTRY_DSN`, `DADATA_API_KEY`.

---

## Ротация GitHub Actions secrets

```
GitHub repo → Settings → Secrets and variables → Actions → выбрать секрет → Update
```

- `VPS_SSH_KEY` — генерируй новую ssh-пару (`ssh-keygen -t ed25519`), добавь public key в `~/.ssh/authorized_keys` на VPS, обнови private в Secrets, удали старый public с VPS.
- `VPS_HOST` — меняется только при смене IP/домена VPS.
- `TELEGRAM_OPS_BOT_TOKEN` — синхронизируй с Coolify env `NUXT_TELEGRAM_OPS_BOT_TOKEN`.
- `TELEGRAM_OPS_CHAT_ID` — статичный идентификатор канала, не секрет в крипто-смысле.

После обновления — дёрни workflow вручную (`workflow_dispatch`) или дождись след. push'а.

---

## Откат

Если после ротации посыпались 403/500:

1. **Coolify env-секрет** → верни OLD в env переменную → Redeploy. Время отката ≈ 1-2 мин.
2. **Vault-секрет** → `SELECT vault.update_secret(id, '<OLD>') FROM vault.secrets WHERE name = '<key>';` — мгновенно.
3. **Bot token / Supabase service role** — отката НЕТ. Старый уже умер. Единственный путь — допроверь deploy и продавливай.
4. **Edge function secret** → восстанови `.secrets` → `docker restart`.

---

## Чеклист квартальной ротации

- [ ] `telegram_internal_secret` (Vault)
- [ ] `reminder_cron_secret` (Vault)
- [ ] `NUXT_TELEGRAM_WEBHOOK_SECRET` (Coolify)
- [ ] `NUXT_SUPABASE_SERVICE_ROLE_KEY` (Coolify + edge)
- [ ] `YOOKASSA_WEBHOOK_SECRET` (edge + ЮKassa Console)
- [ ] `OPENAI_API_KEY` (OpenAI Console + Coolify)
- [ ] `VPS_SSH_KEY` (GitHub + VPS authorized_keys)
- [ ] Запись в журнал ротаций (дата, кто, причина)
- [ ] Sentry 30 мин без 401/403/500-всплесков
