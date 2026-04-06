import * as Sentry from '@sentry/nuxt'

if (!import.meta.dev) {
  Sentry.init({
    dsn: 'https://18e41139124871552db25df7db866a49@o4511110689980416.ingest.de.sentry.io/4511110692405328',
    tracesSampleRate: 1.0,
  })
}
