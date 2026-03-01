export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  ssr: true,

  modules: ['@pinia/nuxt', '@nuxt/eslint', '@vueuse/nuxt'],

  css: ['~/assets/css/reset.css'],

  runtimeConfig: {
    firebaseAdminCredentials: '',
    public: {
      firebaseApiKey: '',
      firebaseAuthDomain: '',
      firebaseProjectId: '',
      firebaseStorageBucket: '',
      firebaseMessagingSenderId: '',
      firebaseAppId: '',
    },
  },
})
