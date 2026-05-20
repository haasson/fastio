import * as Sentry from '@sentry/nuxt'

// TECHDEBT.sentry-dsn (was pre-existing): DSN из env. На сервере доступен
// process.env напрямую — без необходимости в useRuntimeConfig (Nuxt ещё не
// запущен на этом этапе initialization). Если DSN не задан — Sentry не
// инициализируется (silent skip для локалки / preview без секрета).
const dsn = process.env.NUXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN

if (!import.meta.dev && dsn) {
  // PREPROD-228: default 0.01 (1%) — экономим квоту Sentry. Поднять можно
  // через env SENTRY_TRACES_SAMPLE_RATE без передеплоя.
  const envRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE)

  Sentry.init({
    dsn,
    tracesSampleRate: Number.isFinite(envRate) && envRate > 0 ? envRate : 0.01,
  })
}
