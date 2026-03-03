<template>
  <div class="invite-root">
    <div class="card">
      <div class="logo">
        <UiAppLogo :size="32" />
        <UiTitle size="h4">Fastio</UiTitle>
      </div>

      <UiText v-if="loading" size="small" class="loading-msg">Принимаем приглашение…</UiText>

      <UiSpace v-else-if="error" :size="16" vertical>
        <UiAlert type="error">{{ error }}</UiAlert>
        <UiButton type="primary" full-width @click="navigateTo('/')">На главную</UiButton>
      </UiSpace>

      <UiSpace v-else-if="success" :size="16" vertical>
        <UiAlert type="success">Вы присоединились к команде!</UiAlert>
        <UiButton type="primary" full-width @click="navigateTo('/')">Перейти в панель</UiButton>
      </UiSpace>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { definePageMeta, useRoute, useNuxtApp, navigateTo } from '#imports'
import { UiButton, UiAlert, UiTitle, UiText, UiSpace } from '@fastio/ui'
import UiAppLogo from '~/components/ui/AppLogo.vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: false })

const route = useRoute()
const { $supabase } = useNuxtApp()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref('')
const success = ref(false)

onMounted(async () => {
  const token = route.query.token as string

  if (!token) {
    error.value = 'Неверная ссылка приглашения'
    loading.value = false

    return
  }

  // Ждём инициализации auth
  if (authStore.loading) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => authStore.loading,
        (val) => {
          if (!val) {
            unwatch()
            resolve()
          }
        },
      )
    })
  }

  // Если не авторизован — редирект на логин с возвратом
  if (!authStore.isAuthenticated) {
    await navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`)

    return
  }

  // Принимаем инвайт
  const { data, error: fnError } = await $supabase.functions.invoke('accept-invite', {
    body: { token },
  })

  if (fnError || data?.error) {
    error.value = data?.error ?? 'Не удалось принять приглашение'
  } else {
    success.value = true
  }

  loading.value = false
})
</script>

<style scoped lang="scss">
.invite-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-page);
  padding: 16px;
}

.card {
  background: var(--color-bg-card);
  border-radius: 16px;
  padding: 40px 32px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 32px;
}

.loading-msg {
  text-align: center;
  padding: 20px 0;
}
</style>
