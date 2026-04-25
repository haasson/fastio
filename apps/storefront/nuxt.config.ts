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

  components: false,

  modules: ['@pinia/nuxt', '@nuxt/eslint', '@vueuse/nuxt', '@sentry/nuxt/module'],

  runtimeConfig: {
    supabaseServiceRoleKey: '',
    dadataApiKey: '',
    telegramAuthBotToken: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      yandexMapsApiKey: '',
      telegramAuthBotUsername: '',
    },
  },
})
