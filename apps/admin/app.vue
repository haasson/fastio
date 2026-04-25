<template>
  <UiConfigProvider :is-dark="isDark">
    <UiConfirmModal />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UiConfigProvider>
</template>

<script setup lang="ts">
import { provide, onMounted, computed } from 'vue'
import { useDark } from '@vueuse/core'
import { navigateTo, useHead } from '#imports'
import { UiConfigProvider, UiConfirmModal } from '@fastio/ui'
import { INVITE_PENDING_KEY } from '~/utils/constants'
import { useTenantStore } from '~/stores/tenant'

const tenantStore = useTenantStore()

useHead({
  title: computed(() => tenantStore.maybeTenant?.name ? `${tenantStore.maybeTenant.name} — Fastio` : 'Fastio'),
})

const isDark = useDark({
  attribute: 'data-theme',
  valueDark: 'dark',
  valueLight: 'light',
  storageKey: 'fastio:theme',
})

provide('isDark', isDark)

// Invite-flow: если пользователь пришёл по invite-ссылке — отправляем на
// установку пароля. Флаг выставляется в плагине до createClient.
onMounted(() => {
  if (sessionStorage.getItem(INVITE_PENDING_KEY)) {
    navigateTo('/set-password')
  }
})
</script>
