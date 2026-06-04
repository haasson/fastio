# syntax=docker/dockerfile:1.7
# Параметризованный билд одного Nuxt-аппа из монорепо.
# ARG APP_PKG — имя пакета для turbo-фильтра (напр. "admin" или "@fastio/landing")
# ARG APP_DIR — папка аппа в apps/ для пути .output (напр. "admin", "landing")

ARG NODE_IMAGE=node:22-bookworm-slim

# ── base: pnpm через corepack ───────────────────────────────────────
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ── pruner: turbo prune отрезает только нужный пакет + его deps ──────
FROM base AS pruner
RUN pnpm add -g turbo@2.3.3
COPY . .
ARG APP_PKG
RUN turbo prune "${APP_PKG}" --docker

# ── installer: ставим deps по pruned-лок-файлу, потом билдим ─────────
FROM base AS installer
ARG APP_PKG
ARG APP_DIR
# 1) только манифесты → ставим зависимости (кешируемый слой)
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
# 2) исходники pruned-набора
COPY --from=pruner /app/out/full/ .
# 3) build-time public env (пекутся в бандл; см. план — только NON-secret public)
ARG NUXT_PUBLIC_SUPABASE_URL
ARG NUXT_PUBLIC_SUPABASE_ANON_KEY
ARG NUXT_PUBLIC_YANDEX_MAPS_API_KEY
ARG NUXT_PUBLIC_YANDEX_METRIKA_ID
ARG NUXT_PUBLIC_TELEGRAM_TENANT_BOT_USERNAME
ARG NUXT_PUBLIC_TELEGRAM_CLIENT_BOT_USERNAME
ARG NUXT_PUBLIC_HELP_URL
ARG NUXT_PUBLIC_ADMIN_URL
ARG NUXT_PUBLIC_SITE_URL
ARG NUXT_PUBLIC_AUDIT_LOG_ENABLED
ARG NUXT_PUBLIC_SENTRY_DSN
ARG SOURCE_COMMIT
ENV NUXT_PUBLIC_SUPABASE_URL=$NUXT_PUBLIC_SUPABASE_URL \
    NUXT_PUBLIC_SUPABASE_ANON_KEY=$NUXT_PUBLIC_SUPABASE_ANON_KEY \
    NUXT_PUBLIC_YANDEX_MAPS_API_KEY=$NUXT_PUBLIC_YANDEX_MAPS_API_KEY \
    NUXT_PUBLIC_YANDEX_METRIKA_ID=$NUXT_PUBLIC_YANDEX_METRIKA_ID \
    NUXT_PUBLIC_TELEGRAM_TENANT_BOT_USERNAME=$NUXT_PUBLIC_TELEGRAM_TENANT_BOT_USERNAME \
    NUXT_PUBLIC_TELEGRAM_CLIENT_BOT_USERNAME=$NUXT_PUBLIC_TELEGRAM_CLIENT_BOT_USERNAME \
    NUXT_PUBLIC_HELP_URL=$NUXT_PUBLIC_HELP_URL \
    NUXT_PUBLIC_ADMIN_URL=$NUXT_PUBLIC_ADMIN_URL \
    NUXT_PUBLIC_SITE_URL=$NUXT_PUBLIC_SITE_URL \
    NUXT_PUBLIC_AUDIT_LOG_ENABLED=$NUXT_PUBLIC_AUDIT_LOG_ENABLED \
    NUXT_PUBLIC_SENTRY_DSN=$NUXT_PUBLIC_SENTRY_DSN \
    SOURCE_COMMIT=$SOURCE_COMMIT \
    NODE_ENV=production
# 4) сборка (turbo соберёт ^build зависимостей @fastio/*). SENTRY_AUTH_TOKEN — через secret-mount.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm turbo run build --filter="${APP_PKG}"

# ── runner: тонкий образ, только .output ────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
ARG APP_DIR
COPY --from=installer /app/apps/${APP_DIR}/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
