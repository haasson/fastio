export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devServer: { port: 4710 },

  routeRules: {
    '/kitchen': { redirect: '/kitchen/queue' },
    '/content': { redirect: '/content/banners' },
    '/promotions': { redirect: '/promotions/list' },
    '/menu': { redirect: '/menu/dishes' },
    '/tables': { redirect: '/tables/list' },
    '/reservations': { redirect: '/reservations/list' },
    '/appearance': { redirect: '/appearance/sections' },
    '/settings': { redirect: '/settings/contacts' },
    '/account': { redirect: '/account/profile' },
    '/team': { redirect: '/team/members' },
  },

  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  ssr: false,

  imports: {
    autoImport: false,
  },

  components: false,

  modules: ['@pinia/nuxt', '@vueuse/nuxt'],

  css: ['~/assets/css/ui.scss', 'vue-yandex-maps/css'],

  runtimeConfig: {
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      yandexMapsApiKey: '',
      dadataApiKey: '',
    },
  },
})
