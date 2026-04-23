export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devServer: { port: 4713 },
  ssr: true,
  css: ['~/assets/styles/main.scss'],
  components: false,
  modules: ['@nuxt/eslint'],
  runtimeConfig: {
    public: {
      supabaseUrl: '', // NUXT_PUBLIC_SUPABASE_URL
      supabaseAnonKey: '', // NUXT_PUBLIC_SUPABASE_ANON_KEY
    },
  },
  app: {
    head: {
      title: 'Fastio — сайт с онлайн-заказами для любого бизнеса',
      htmlAttrs: { lang: 'ru' },
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
      meta: [
        { name: 'description', content: 'Запустите свой сайт с онлайн-заказами за 5 минут. Для кафе, салонов, частных мастеров.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
