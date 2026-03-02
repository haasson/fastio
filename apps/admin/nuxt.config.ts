export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devServer: { port: 4710 },

  app: {
    head: {
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  ssr: false,

  imports: {
    dirs: ['utils/**'],
  },

  modules: ['@pinia/nuxt', '@nuxt/eslint', '@vueuse/nuxt'],

  css: ['~/assets/css/reset.css', '~/assets/css/admin-theme.css'],

  runtimeConfig: {
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
    },
  },
})
