import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    dedupe: ['vue', 'pinia'],
    alias: {
      'vue': resolve(__dirname, 'apps/admin/node_modules/vue'),
      'pinia': resolve(__dirname, 'apps/admin/node_modules/pinia'),
      'vue-router': resolve(__dirname, 'apps/admin/test-utils/vue-router-stub.ts'),
      '#imports': resolve(__dirname, 'apps/admin/test-utils/nuxt-imports-stub.ts'),
      '~': resolve(__dirname, 'apps/admin'),
      '@fastio/shared': resolve(__dirname, 'packages/shared/src'),
      '@fastio/ui': resolve(__dirname, 'packages/ui/src'),
      '@fastio/icons': resolve(__dirname, 'packages/icons/src'),
      '@fastio/kit': resolve(__dirname, 'packages/kit/src'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: [
      'packages/shared/src/**/*.test.ts',
      'packages/public-ui/src/**/*.test.ts',
      'apps/admin/**/*.test.ts',
      'apps/storefront/**/*.test.ts',
      'apps/backoffice/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.config.*'],
    },
  },
} as Parameters<typeof defineConfig>[0])
