export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devServer: { port: 4711 },

  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg', key: 'favicon' }],
    },
  },

  ssr: true,

  css: ['~/assets/styles/main.scss'],

  components: false,

  modules: ['@pinia/nuxt', '@nuxt/eslint', '@vueuse/nuxt', '@sentry/nuxt/module'],

  runtimeConfig: {
    supabaseServiceRoleKey: '',
    dadataApiKey: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      yandexMapsApiKey: '',
    },
  },
})
