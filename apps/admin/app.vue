<template>
  <UiConfigProvider :is-dark="isDark">
    <UiConfirmModal />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UiConfigProvider>
</template>

<script setup lang="ts">
import { ref, watch, provide, onMounted } from 'vue'
import { navigateTo } from '#imports'
import { UiConfigProvider, UiConfirmModal } from '@fastio/ui'

const isDark = ref(false)

watch(isDark, (dark) => {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}, { immediate: true })

// Sync isDark when data-theme is changed externally (e.g. via DevTools)
onMounted(() => {
  const observer = new MutationObserver(() => {
    const theme = document.documentElement.getAttribute('data-theme')

    isDark.value = theme === 'dark'
  })

  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
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

// TODO: не проще переложить сразу всё, а потом фильтрануть?
