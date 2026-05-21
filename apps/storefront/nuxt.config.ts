export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devServer: { port: 4711 },

  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg', key: 'favicon' }],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
    },
  },

  ssr: true,

  css: ['~/assets/styles/main.scss', 'photoswipe/style.css'],

  // Phase 6 storefront использует `~/shared/` для composables/utils/data. Nuxt 3.12+
  // ввёл встроенный namespace `~/shared/` для cross-runtime (client+server) utilities
  // с impound plugin'ом, который запрещает там `#app` и Vue-composables.
  // Переезжаем Nuxt-shared в `nuxt-shared/` — освобождаем наш `~/shared/` от ограничений.
  dir: {
    shared: 'nuxt-shared',
  },

  components: false,

  modules: ['@pinia/nuxt', '@nuxt/eslint', '@vueuse/nuxt', '@sentry/nuxt/module'],

  // Phase 02-observability: wire Sentry/GlitchTip server-side instrumentation.
  // autoInjectServerSentry: 'experimental_dynamic-import' — wraps the Nitro
  // server entrypoint with a dynamic import() so Sentry initialises before
  // any app code runs (equivalent to --import flag). Required for OBS-01.
  // sentryUrl: self-hosted GlitchTip instance (Sentry-API-compatible).
  // org/project/authToken: read from SENTRY_ORG / SENTRY_PROJECT /
  // SENTRY_AUTH_TOKEN env vars at build time (set in Coolify).
  // telemetry: false — never phone home to sentry.io from a self-hosted setup.
  sentry: {
    autoInjectServerSentry: 'experimental_dynamic-import',
    sentryUrl: 'https://errors.fastio.ru',
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    telemetry: false,
  },

  runtimeConfig: {
    supabaseServiceRoleKey: '',
    dadataApiKey: '',
    telegramClientBotToken: '',
    telegramProxyUrl: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      yandexMapsApiKey: '',
      telegramClientBotUsername: '',
      // TECHDEBT.sentry-dsn: DSN из env (NUXT_PUBLIC_SENTRY_DSN), а не хардкод.
      // Если пусто — Sentry не инициализируется.
      sentryDsn: '',
    },
  },
})
