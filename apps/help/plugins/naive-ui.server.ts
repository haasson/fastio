import { setup } from '@css-render/vue3-ssr'
import { defineNuxtPlugin } from '#imports'

// Собирает стили css-render от Naive UI во время SSR и прокидывает collect()
// в event.context, чтобы nitro-плагин (server/plugins/naive-ui-ssr.ts) вставил
// их в <head> после рендера. Без этого при первом запросе страница приходит
// без стилей (FOUC до hydration).
export default defineNuxtPlugin((nuxtApp) => {
  const { collect } = setup(nuxtApp.vueApp)
  const ctx = nuxtApp.ssrContext?.event?.context as { naiveCollect?: () => string } | undefined

  if (ctx) ctx.naiveCollect = collect
})
