import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devServer: { port: 4710 },

  nitro: {
    storage: {
      'ai-knowledge': {
        driver: 'fs',
        base: resolve(rootDir, 'server/ai/knowledge'),
      },
      'kb': {
        driver: 'fs',
        base: resolve(rootDir, '../../packages/kb/content'),
      },
    },
  },

  routeRules: {
    '/kitchen': { redirect: '/kitchen/queue' },
    '/content': { redirect: '/content/banners' },
    '/promotions': { redirect: '/promotions/list' },
    '/menu': { redirect: '/menu/dishes' },
    '/services': { redirect: '/services/items' },
    '/appointments': { redirect: '/appointments/list' },
    '/tables': { redirect: '/tables/list' },
    '/reservations': { redirect: '/reservations/list' },
    '/appearance': { redirect: '/appearance/sections' },
    '/settings': { redirect: '/settings/contacts' },
    '/account': { redirect: '/account/profile' },
    '/team': { redirect: '/team/members' },
  },

  app: {
    head: {
      charset: 'utf-8',
      title: 'Fastio — Панель управления',
      meta: [
        { name: 'description', content: 'Управляйте меню, заказами, бронированиями и настройками вашего заведения' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Unbounded:wght@800&display=swap' },
      ],
    },
  },

  ssr: false,

  imports: {
    autoImport: false,
  },

  components: false,

  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@sentry/nuxt/module'],

  css: ['~/assets/css/ui.scss', 'vue-yandex-maps/css', 'driver.js/dist/driver.css', '~/assets/css/tour.scss'],

  runtimeConfig: {
    openaiApiKey: '',
    supabaseServiceRoleKey: '',
    telegramBotToken: '',
    telegramAuthBotToken: '',
    telegramWebhookSecret: '',
    reminderCronSecret: '',
    internalApiSecret: '',
    adminUrl: '',
    dadataApiKey: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      yandexMapsApiKey: '',
      telegramBotUsername: '',
      helpUrl: 'https://help.fastio.ru',
    },
  },
})
