import { useNuxtData, navigateTo } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'

export default defineNuxtRouteMiddleware(() => {
  const { data: tenant } = useNuxtData<Tenant>('tenant')
  if (tenant.value?.modules?.promotions === false) {
    return navigateTo('/')
  }
})
