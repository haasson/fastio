# GlitchTip → Telegram Alert Integration

**Purpose:** Route every new GlitchTip issue to the team ops Telegram channel. Zero code — native GlitchTip Telegram integration only.

**Latency target:** < 5 min (phase success criterion 2).

---

## Prerequisites

- GlitchTip project exists at `https://errors.fastio.ru`
- Ops bot token: `NUXT_TELEGRAM_OPS_BOT_TOKEN` (reuse existing, no new token)
- Alert chat ID: `NUXT_TELEGRAM_ALERT_CHAT_ID` (reuse existing ops alert chat)
- The ops bot must be a member of the alert chat. Verify: send any message via `sendMessage` to the chat ID; if not a member, add the bot first.

---

## Configuration Steps

### 1. Verify bot membership

```bash
curl -s "https://api.telegram.org/bot<NUXT_TELEGRAM_OPS_BOT_TOKEN>/getChat?chat_id=<NUXT_TELEGRAM_ALERT_CHAT_ID>"
```

Expected: `"ok": true` with chat info. If `"ok": false` — add the bot to the chat first.

### 2. Add Telegram alert in GlitchTip UI

GlitchTip 5.x exposes a native Telegram integration under Project Alerts.

1. Open `https://errors.fastio.ru` → select the project → **Settings** → **Alerts**
2. Click **Add Alert**
3. Set **Alert type** to **Telegram**
4. Enter:
   - **Bot Token:** value of `NUXT_TELEGRAM_OPS_BOT_TOKEN`
   - **Chat ID:** value of `NUXT_TELEGRAM_ALERT_CHAT_ID`
5. Set **Trigger:** `New Issue` (fires once per unique fingerprint, not on every occurrence)
6. Set **Frequency:** the lowest available (e.g. 1 minute) — ensures < 5 min delivery
7. Click **Save** / **Create Alert**

> If the GlitchTip version deployed at `errors.fastio.ru` does not show a native Telegram option, use **Webhook** instead and point it at a Telegram-relay endpoint. Check the deployed GlitchTip version: `docker exec glitchtip-web glitchtip --version` or inspect the Alerts UI — if only Webhook is offered, see §Webhook fallback below.

### 3. Test the alert

Trigger a **new** error (a previously unseen fingerprint so GlitchTip treats it as a new issue):

```bash
# Reuse the throwing route from plan 02-02, or hit the test endpoint directly
curl https://admin.fastio.ru/api/sentry-test-error
```

Wait up to 5 minutes. Expect a Telegram message in the ops alert chat with issue title, project, and a link to `errors.fastio.ru`.

---

## Webhook Fallback (if native Telegram option absent)

Some GlitchTip builds expose **Webhook** (not a dedicated Telegram option). In that case:

1. In Alerts → Add Alert → **Webhook**
2. **URL:** `https://api.telegram.org/bot<NUXT_TELEGRAM_OPS_BOT_TOKEN>/sendMessage`
3. GlitchTip sends a JSON POST; Telegram's Bot API expects `chat_id` and `text` fields.
   - If GlitchTip allows a custom payload template, set:
     ```json
     {"chat_id": "<NUXT_TELEGRAM_ALERT_CHAT_ID>", "text": "GlitchTip: {{ issue.title }} — {{ issue.short_id }}"}
     ```
   - If no template support: the raw GlitchTip webhook payload will not match the Telegram API schema. In this case a lightweight relay function is needed — flag as a deviation and document in SUMMARY.

---

## Relationship to notify-alert.post.ts (D-05)

`apps/admin/server/api/telegram/notify-alert.post.ts` is a **separate, threshold-based monitor** — it fires when Edge Function 4xx/5xx error rates exceed a threshold (called by `monitor_edge_errors()` via `pg_net` every 15 min). It is **not modified by this plan** and runs completely independently of the GlitchTip native alert.

| Mechanism | Trigger | Source | Modified? |
|---|---|---|---|
| GlitchTip native Telegram alert | New unique issue in GlitchTip | GlitchTip worker | No (UI config only) |
| `notify-alert.post.ts` | Edge function error rate > threshold | PostgreSQL pg_net cron | **No — untouched** |

Both run in parallel. They alert on different signals and do not interfere.

---

## Environment Variables

| Var | Where set | Used by |
|---|---|---|
| `NUXT_TELEGRAM_OPS_BOT_TOKEN` | Coolify admin app env | `notify-alert.post.ts` (existing) + GlitchTip Telegram alert config |
| `NUXT_TELEGRAM_ALERT_CHAT_ID` | Coolify admin app env | `notify-alert.post.ts` (existing) + GlitchTip Telegram alert config |

No new env vars needed. No code changes required.

---

## Verification Checklist

- [ ] GlitchTip Alerts page shows the Telegram alert as active
- [ ] A new error event arrives as a Telegram message in the ops chat within 5 min
- [ ] `git diff HEAD apps/admin/server/api/telegram/notify-alert.post.ts` — empty (no changes)
