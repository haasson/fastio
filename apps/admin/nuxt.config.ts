import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))

// Dev: ssr:true + routeRules { '/**': { ssr: false } } обходит Nuxt 3.21 bug
// (при ssr:false env NUXT_VITE_NODE_OPTIONS не ставится для child процессов,
// renderer падает на getClientManifest IPC → 500 на каждый cold-запрос).
// vite-node socket поднимается как для storefront ssr:true, но per-route SSR
// не делается — каждая страница рендерится client-only из SPA shell.
//
// Prod: ssr:false как было раньше. При ssr:true в build падает Rollup на
// scoped style компонентов (TenantSwitcher etc) — Vite не может обработать
// inline style imports в SSR-environment. Coolify запускает в проде, vite-node
// IPC там не нужен (всё уже собрано в .output).
const isDev = process.env.NODE_ENV !== 'production'

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

  ssr: isDev,

  routeRules: {
    ...(isDev ? { '/**': { ssr: false } } : {}),
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

  // Phase 02-observability: wire Sentry/GlitchTip server-side instrumentation.
  // autoInjectServerSentry: 'experimental_dynamic-import' — wraps the Nitro
  // server entrypoint with a dynamic import() so Sentry initialises before
  // any app code runs (equivalent to --import flag). Required for OBS-01.
  // Admin is a client SPA in prod (ssr:false), but the module option is set
  // for consistency and to cover the isDev SSR path.
  // sentryUrl: self-hosted GlitchTip instance (Sentry-API-compatible).
  // org/project/authToken: read from SENTRY_ORG / SENTRY_PROJECT /
  // SENTRY_AUTH_TOKEN env vars at build time (set in Coolify).
  // telemetry: false — never phone home to sentry.io from a self-hosted setup.
  sentry: {
    autoInjectServerSentry: 'experimental_dynamic-import',
    sentryUrl: 'https://errors.fastio.ru',
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    telemetry: false,
  },

  // vue-yandex-maps/css импортируется внутри features/settings/components/DeliveryZoneMap.vue,
  // чтобы CSS попадал в lazy-chunk вместе с компонентом, а не в main bundle.
  css: ['~/assets/css/ui.scss', 'driver.js/dist/driver.css', '~/assets/css/tour.scss'],

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
    relaySecret: '',
    adminUrl: '',
    dadataApiKey: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      yandexMapsApiKey: '',
      telegramTenantBotUsername: '',
      helpUrl: 'https://help.fastio.ru',
      auditLogEnabled: false,
      // TECHDEBT.sentry-dsn: DSN из env (NUXT_PUBLIC_SENTRY_DSN), а не хардкод.
      // Если пусто — Sentry не инициализируется (отключается локально без секрета).
      sentryDsn: '',
    },
  },
})
