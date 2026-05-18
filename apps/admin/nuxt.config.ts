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

  // ssr:true для admin чтобы Nuxt vite-builder поднял vite-node socket
  // (при ssr:false env NUXT_VITE_NODE_OPTIONS не ставится для child процессов,
  // renderer падает на getClientManifest IPC). Реально SPA-режим сохраняется
  // через routeRules ниже: каждая страница рендерится client-only, server
  // отдаёт только SPA shell. См. TECHDEBT «Admin dev SSR shell broken».
  ssr: true,

  routeRules: {
    // /**: { ssr: false } — все pages в SPA-режиме (как ssr:false глобально).
    // Серверный SSR не пытается рендерить content страницы (auth-store
    // требует браузера), но shell со script-тегами генерируется нормально.
    '/**': { ssr: false },
    // route redirects (раньше были в основном routeRules-блоке):
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

  imports: {
    autoImport: false,
  },

  components: false,

  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@sentry/nuxt/module'],

  css: ['~/assets/css/ui.scss', 'vue-yandex-maps/css', 'driver.js/dist/driver.css', '~/assets/css/tour.scss'],

  runtimeConfig: {
    openaiApiKey: '',
    supabaseServiceRoleKey: '',
    telegramTenantBotToken: '',
    telegramClientBotToken: '',
    telegramOpsBotToken: '',
    telegramWebhookSecret: '',
    telegramAuthWebhookUrl: '',
    telegramTenantWebhookUrl: '',
    telegramAlertChatId: '',
    telegramProxyUrl: '',
    reminderCronSecret: '',
    internalApiSecret: '',
    adminUrl: '',
    dadataApiKey: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      yandexMapsApiKey: '',
      telegramTenantBotUsername: '',
      helpUrl: 'https://help.fastio.ru',
      auditLogEnabled: false,
    },
  },
})
