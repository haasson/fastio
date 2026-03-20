import { defineNuxtPlugin, useRouter, useRoute } from 'nuxt/app'

export default defineNuxtPlugin(() => {
  if (!import.meta.dev) return

  const router = useRouter()
  const route = useRoute()

  router.beforeEach((to) => {
    const slug = route.query.slug as string | undefined
    if (slug && !to.query.slug) {
      return { ...to, query: { ...to.query, slug } }
    }
  })
})
