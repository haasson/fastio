import { getAuth } from 'firebase/auth'

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const auth = getAuth()
  const user = auth.currentUser

  if (!user && to.path !== '/login') {
    return navigateTo('/login')
  }
})
