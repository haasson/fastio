# GlitchTip Deployment Runbook

**Target:** `https://errors.fastio.ru`  
**Host:** VPS `109.71.242.205` (Coolify v4)  
**TLS:** Traefik wildcard cert `*.fastio.ru` — already covers this subdomain, no extra cert work.

---

## 1. DNS

In Timeweb Cloud DNS zone `fastio.ru`, add:

```
A  errors  109.71.242.205  TTL 300
```

Verify: `dig errors.fastio.ru +short` → `109.71.242.205`

---

## 2. Docker Compose Stack

Paste into Coolify → New Resource → Docker Compose. Use the compose below verbatim.

```yaml
services:
  web:
    image: glitchtip/glitchtip:latest
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "8000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SECRET_KEY: ${SECRET_KEY}
      REDIS_URL: ${REDIS_URL}
      GLITCHTIP_DOMAIN: ${GLITCHTIP_DOMAIN}
      EMAIL_URL: ${EMAIL_URL}
      DEFAULT_FROM_EMAIL: ${DEFAULT_FROM_EMAIL}
      ENABLE_OPEN_USER_REGISTRATION: ${ENABLE_OPEN_USER_REGISTRATION}
    restart: unless-stopped

  worker:
    image: glitchtip/glitchtip:latest
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: ./bin/run-celery-with-beat.sh
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SECRET_KEY: ${SECRET_KEY}
      REDIS_URL: ${REDIS_URL}
      GLITCHTIP_DOMAIN: ${GLITCHTIP_DOMAIN}
      EMAIL_URL: ${EMAIL_URL}
      DEFAULT_FROM_EMAIL: ${DEFAULT_FROM_EMAIL}
      ENABLE_OPEN_USER_REGISTRATION: ${ENABLE_OPEN_USER_REGISTRATION}
    restart: unless-stopped

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: glitchtip
      POSTGRES_USER: glitchtip
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - glitchtip_postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U glitchtip"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - glitchtip_redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  glitchtip_postgres:
  glitchtip_redis:
```

---

## 3. Environment Variables

Set these in Coolify → resource env vars before first deploy.

| Variable | Value |
|---|---|
| `SECRET_KEY` | `openssl rand -hex 50` — generate once, never rotate |
| `POSTGRES_PASSWORD` | `openssl rand -hex 32` — generate once |
| `DATABASE_URL` | `postgresql://glitchtip:<POSTGRES_PASSWORD>@postgres:5432/glitchtip` |
| `REDIS_URL` | `redis://redis:6379/` |
| `GLITCHTIP_DOMAIN` | `https://errors.fastio.ru` |
| `EMAIL_URL` | `smtp://noreply%40fastio.ru:<SMTP_PASS>@smtp.timeweb.ru:465/?ssl=True` (URL-encode the `@` in user as `%40`) |
| `DEFAULT_FROM_EMAIL` | `noreply@fastio.ru` |
| `ENABLE_OPEN_USER_REGISTRATION` | `true` (bootstrap only — flip to `false` after first account) |

`SMTP_PASS` = the same password used for `SMTP_PASS` in Supabase GoTrue config (Timeweb mail, `smtp.timeweb.ru:465`).

---

## 4. Coolify Resource Config

1. New Resource → Docker Compose → paste compose above.
2. Domain: `errors.fastio.ru` → assign to the `web` service, port `8000`.
3. TLS: Coolify picks up the existing `*.fastio.ru` Traefik wildcard cert automatically.
4. Set all env vars from Section 3.
5. Deploy.

Wait for `web` and `worker` containers to be healthy. First start runs Django migrations automatically.

---

## 5. Admin Bootstrap

1. Open `https://errors.fastio.ru` — should show GlitchTip register/login screen.
2. Register the first admin account (email + password — this becomes the owner).
3. Go back to Coolify → resource env vars → set `ENABLE_OPEN_USER_REGISTRATION=false` → Redeploy.
4. Confirm: open `https://errors.fastio.ru/register` — must return 403 or redirect, not the register form.

---

## 6. Create Project and Get DSN

1. In GlitchTip UI → Organizations → create org `Fastio` (if not auto-created).
2. Projects → New Project → Platform: `JavaScript` → Name: `fastio`.
   - Optionally create a second project `fastio-storefront` if separate tracking is desired; one project is sufficient.
3. Project Settings → Client Keys → copy the DSN.

DSN format: `https://<key>@errors.fastio.ru/<project-id>`

Paste this DSN into:
- Coolify → `apps/admin` env: `NUXT_PUBLIC_SENTRY_DSN=<dsn>`
- Coolify → `apps/storefront` env: `NUXT_PUBLIC_SENTRY_DSN=<dsn>`

(Plan 02 wires these env vars into `@sentry/nuxt` module config.)

---

## 7. Telegram Alerts (Plan 03)

Configure after the instance is live. GlitchTip → Project Settings → Alerts → New Alert → Telegram.
Uses `NUXT_TELEGRAM_OPS_BOT_TOKEN` / `NUXT_TELEGRAM_ALERT_CHAT_ID` — already configured in Coolify for admin app.

---

## 8. Verification Checklist

- [ ] `dig errors.fastio.ru +short` → `109.71.242.205`
- [ ] `curl -Is https://errors.fastio.ru | head -1` → `HTTP/2 200`
- [ ] GlitchTip login screen loads over HTTPS (valid wildcard cert)
- [ ] Admin account created
- [ ] `ENABLE_OPEN_USER_REGISTRATION=false` applied and registration endpoint returns 403
- [ ] Project exists and DSN is copied
