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
    },
  },
})
