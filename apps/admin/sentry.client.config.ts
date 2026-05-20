import * as Sentry from '@sentry/nuxt'

// TECHDEBT.sentry-dsn (was pre-existing): DSN читаем из env, а не хардкодим.
// Sentry runs ДО useRuntimeConfig(), поэтому идём через import.meta.env (Vite
// inline'ит NUXT_PUBLIC_* в client bundle). Если DSN не задан — Sentry не
// инициализируется (локалка / preview без секрета — silent skip).
const dsn = import.meta.env.NUXT_PUBLIC_SENTRY_DSN as string | undefined

if (!import.meta.dev && dsn) {
  // PREPROD-228: default 0.01 (1%) — экономим квоту Sentry. Поднять можно
  // через env NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE без передеплоя.
  const envRate = Number(import.meta.env.NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)

  Sentry.init({
    dsn,
    tracesSampleRate: Number.isFinite(envRate) && envRate > 0 ? envRate : 0.01,
  })
}
