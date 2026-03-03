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
    autoImport: false,
  },

  components: false,

  modules: ['@pinia/nuxt', '@vueuse/nuxt'],

  css: ['~/assets/css/ui.scss', '~/assets/css/admin-theme.css'],

  runtimeConfig: {
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
    },
  },
})
