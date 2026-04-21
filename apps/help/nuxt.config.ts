export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  devServer: { port: 4712 },

  ssr: true,

  app: {
    head: {
      charset: 'utf-8',
      title: 'Fastio — База знаний',
      meta: [
        { name: 'description', content: 'Документация и инструкции по работе с панелью управления Fastio' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Urbanist:wght@700;800&display=swap',
        },
      ],
    },
  },

  imports: {
    autoImport: false,
  },

  components: false,

  css: ['~/assets/main.scss'],

  build: {
    transpile: [
      'naive-ui',
      'vueuc',
      '@css-render/vue3-ssr',
      '@juggle/resize-observer',
    ],
  },

  vite: {
    optimizeDeps: {
      include: ['naive-ui', 'vueuc'],
    },
  },

  runtimeConfig: {
    public: {
      adminUrl: process.env.NUXT_PUBLIC_ADMIN_URL || 'http://localhost:4710',
    },
  },
})
