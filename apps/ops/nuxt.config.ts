export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devServer: { port: 4714 },

  ssr: false,

  imports: {
    autoImport: false,
  },

  components: false,

  // NB: @sentry/nuxt модуль НЕ подключаем в Wave 1 — добавим follow-up tasks позже,
  // когда GlitchTip-проект для ops будет создан (см. RESEARCH Open Question 3).
  // Сам пакет в deps есть, чтобы reportError из @fastio/shared/observability работал
  // если в Wave 2 кому-то понадобится.

  runtimeConfig: {
    supabaseServiceRoleKey: '',     // NUXT_SUPABASE_SERVICE_ROLE_KEY
    internalApiSecret: '',          // NUXT_INTERNAL_API_SECRET — для requireInternalSecret()
    reminderCronSecret: '',         // NUXT_REMINDER_CRON_SECRET — для send-appointment-reminders
    telegramTenantBotToken: '',     // NUXT_TELEGRAM_TENANT_BOT_TOKEN — notify, notify-reservation, notify-appointment-group, notify-table-call
    telegramClientBotToken: '',     // NUXT_TELEGRAM_CLIENT_BOT_TOKEN — send-appointment-reminders
    telegramOpsBotToken: '',        // NUXT_TELEGRAM_OPS_BOT_TOKEN — notify-alert
    telegramAlertChatId: '',        // NUXT_TELEGRAM_ALERT_CHAT_ID — chat id для notify-alert
    telegramProxyUrl: '',           // NUXT_TELEGRAM_PROXY_URL — sing-box HTTP proxy для RKN bypass
    adminUrl: '',                   // NUXT_ADMIN_URL — для inline-кнопок "Позвонить" в notify хендлерах
    public: {
      supabaseUrl: '',              // NUXT_PUBLIC_SUPABASE_URL — используется в utils/supabase.ts
    },
  },
})
