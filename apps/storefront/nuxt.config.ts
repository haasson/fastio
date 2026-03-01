export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  ssr: true,

  modules: ['@pinia/nuxt', '@nuxt/eslint'],

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
