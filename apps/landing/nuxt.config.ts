const SITE_URL = 'https://fastio.ru'
const SITE_TITLE = 'Fastio — сайт с онлайн-заказами для любого бизнеса'
const SITE_DESCRIPTION = 'Запустите свой сайт с онлайн-заказами за 5 минут. Для кафе, салонов, частных мастеров.'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devServer: { port: 4713 },
  ssr: true,
  css: ['~/assets/styles/main.scss'],
  components: false,
  modules: ['@nuxt/eslint'],
  runtimeConfig: {
    supabaseServiceRoleKey: '', // NUXT_SUPABASE_SERVICE_ROLE_KEY
    supabaseJwtPrivateKey: '', // NUXT_SUPABASE_JWT_PRIVATE_KEY
    adminUrl: 'https://admin.fastio.ru', // NUXT_ADMIN_URL
    yandexCaptchaServerKey: '', // NUXT_YANDEX_CAPTCHA_SERVER_KEY — оставь пустым чтобы отключить проверку
    public: {
      siteUrl: SITE_URL, // NUXT_PUBLIC_SITE_URL
      supabaseUrl: '', // NUXT_PUBLIC_SUPABASE_URL
      supabaseAnonKey: '', // NUXT_PUBLIC_SUPABASE_ANON_KEY
      yandexCaptchaClientKey: '', // NUXT_PUBLIC_YANDEX_CAPTCHA_CLIENT_KEY
      yandexMetrikaId: '', // NUXT_PUBLIC_YANDEX_METRIKA_ID
    },
  },
  app: {
    head: {
      title: SITE_TITLE,
      htmlAttrs: { lang: 'ru' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
      meta: [
        { name: 'description', content: SITE_DESCRIPTION },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: SITE_TITLE },
        { property: 'og:description', content: SITE_DESCRIPTION },
      ],
    },
  },
})
