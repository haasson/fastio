import * as Sentry from '@sentry/nuxt'

if (!import.meta.dev) {
  Sentry.init({
    dsn: 'https://a14669efc87ad7295b77cee3cab098b6@o4511110689980416.ingest.de.sentry.io/4511110706561104',
    tracesSampleRate: 1.0,
  })
}
