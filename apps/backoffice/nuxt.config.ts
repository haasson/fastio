export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devServer: { port: 4712 },
  ssr: false,
  imports: { autoImport: false },
  runtimeConfig: {
    supabaseServiceRoleKey: '', // NUXT_SUPABASE_SERVICE_ROLE_KEY
    supabaseJwtPrivateKey: '', // NUXT_SUPABASE_JWT_PRIVATE_KEY — только local dev
    backofficeUser: '', // NUXT_BACKOFFICE_USER
    backofficePass: '', // NUXT_BACKOFFICE_PASS
    adminUrl: 'https://admin.fastio.ru', // NUXT_ADMIN_URL
    fastioInternalToken: '', // NUXT_FASTIO_INTERNAL_TOKEN — server-to-server секрет для edge функций
    public: {
      supabaseUrl: '', // NUXT_PUBLIC_SUPABASE_URL
    },
  },
  css: ['~/assets/css/main.css'],
})
