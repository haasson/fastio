<template>
  <div class="invite-root">
    <div class="card">
      <AppBrand class="brand" />

      <div class="state">
        <UiText v-if="pageLoading" size="small">Загружаем приглашение…</UiText>
        <UiAlert v-else-if="fatalError" type="error">{{ fatalError }}</UiAlert>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { definePageMeta, useRoute, useNuxtApp, navigateTo } from '#imports'
import { UiAlert, UiText } from '@fastio/ui'
import AppBrand from '~/components/ui/AppBrand.vue'

definePageMeta({ layout: false })

const route = useRoute()
const { $supabase } = useNuxtApp()

const pageLoading = ref(true)
const fatalError = ref('')

const token = route.query.token as string

onMounted(async () => {
  if (!token) {
    fatalError.value = 'Неверная ссылка приглашения'
    pageLoading.value = false

    return
  }

  // Если юзер уже авторизован — сразу принимаем инвайт
  const { data: { session } } = await $supabase.auth.getSession()

  if (session) {
    const { error } = await $supabase.functions.invoke('accept-invite', { body: { token } })

    if (error) {
      fatalError.value = 'Не удалось принять приглашение. Возможно, вы уже состоите в команде или email не совпадает.'
      pageLoading.value = false
    } else {
      await navigateTo('/')
    }

    return
  }

  // Загружаем детали инвайта
  const { data, error } = await $supabase.functions.invoke('get-invite', { body: { token } })

  if (error || data?.error) {
    const msg = data?.error ?? ''

    if (msg === 'Invitation already accepted') {
      fatalError.value = 'Это приглашение уже было принято'
    } else if (msg === 'Invitation expired') {
      fatalError.value = 'Срок действия приглашения истёк'
    } else {
      fatalError.value = 'Приглашение не найдено или недействительно'
    }

    pageLoading.value = false

    return
  }

  if (data.userExists) {
    await navigateTo(`/login?token=${token}`)
  } else {
    await navigateTo(`/set-password?token=${token}&email=${encodeURIComponent(data.email)}`)
  }
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

.brand {
  margin-bottom: 32px;
}

.state {
  text-align: center;
}
</style>
