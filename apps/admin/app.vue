<template>
  <UiConfigProvider :theme-overrides="themeOverrides">
    <UiConfirmModal />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UiConfigProvider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { navigateTo } from '#imports'
import { UiConfigProvider, UiConfirmModal, naiveUiThemeOverrides } from '@fastio/ui'

const themeOverrides = naiveUiThemeOverrides

// Invite-flow: если пользователь пришёл по invite-ссылке — отправляем на
// установку пароля. Флаг выставляется в плагине до createClient.
onMounted(() => {
  if (sessionStorage.getItem('fastio:invite-pending')) {
    navigateTo('/set-password')
  }
})
</script>

// TODO: не проще переложить сразу всё, а потом фильтрануть?
