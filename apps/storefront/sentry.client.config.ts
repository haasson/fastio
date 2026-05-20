import * as Sentry from '@sentry/nuxt'

if (!import.meta.dev) {
  // PREPROD-228: default 0.01 (1%) — экономим квоту Sentry. Поднять можно
  // через env NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE без передеплоя.
  const envRate = Number(import.meta.env.NUXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)
  Sentry.init({
    dsn: 'https://18e41139124871552db25df7db866a49@o4511110689980416.ingest.de.sentry.io/4511110692405328',
    tracesSampleRate: Number.isFinite(envRate) && envRate > 0 ? envRate : 0.01,
  })
}
