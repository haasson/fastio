export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  ssr: false,

  modules: ['@pinia/nuxt', '@nuxt/eslint'],

  runtimeConfig: {
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
