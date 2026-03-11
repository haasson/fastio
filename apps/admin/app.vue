<template>
  <UiConfigProvider :is-dark="isDark">
    <UiConfirmModal />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UiConfigProvider>
</template>

<script setup lang="ts">
import { provide, onMounted } from 'vue'
import { useDark } from '@vueuse/core'
import { navigateTo } from '#imports'
import { UiConfigProvider, UiConfirmModal } from '@fastio/ui'

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
  if (sessionStorage.getItem('fastio:invite-pending')) {
    navigateTo('/set-password')
  }
})
</script>
