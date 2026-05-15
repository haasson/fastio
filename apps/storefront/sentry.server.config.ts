// TEMPORARILY: Sentry server-side init disabled — ломает SSR на Coolify-prod build
// (dev работает потому что Sentry активен только в prod через !import.meta.dev).
// После того как разберёмся с корнем — раскомментировать.
// import * as Sentry from '@sentry/nuxt'
//
// if (!import.meta.dev) {
//   Sentry.init({
//     dsn: 'https://18e41139124871552db25df7db866a49@o4511110689980416.ingest.de.sentry.io/4511110692405328',
//     tracesSampleRate: 0.1,
//   })
// }
export {}
