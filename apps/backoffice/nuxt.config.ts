export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devServer: { port: 4712 },
  ssr: false,
  imports: { autoImport: false },
  runtimeConfig: {
    supabaseServiceKey: '', // NUXT_SUPABASE_SERVICE_KEY
    supabaseJwtPrivateKey: '', // NUXT_SUPABASE_JWT_PRIVATE_KEY — только local dev
    public: {
      supabaseUrl: '', // NUXT_PUBLIC_SUPABASE_URL
    },
  },
  css: ['~/assets/css/main.css'],
})
