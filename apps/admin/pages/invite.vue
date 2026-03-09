<template>
  <div class="invite-root">
    <UiCard size="large" class="auth-card">
      <AppBrand class="brand" />

      <div class="state">
        <UiText v-if="pageLoading" size="small">Загружаем приглашение…</UiText>
        <UiAlert v-else-if="fatalError" type="error">{{ fatalError }}</UiAlert>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { definePageMeta, useRoute, navigateTo } from '#imports'
import { useDatabase } from '~/composables/data/useDatabase'
import { UiCard, UiAlert, UiText } from '@fastio/ui'
import AppBrand from '~/components/ui/AppBrand.vue'

definePageMeta({ layout: false })

const route = useRoute()
const api = useDatabase()

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
  const { data: { session } } = await api.auth.getSession()

  if (session) {
    const { error } = await api.functions.acceptInvite({ token })

    if (error) {
      fatalError.value = 'Не удалось принять приглашение. Возможно, вы уже состоите в команде или email не совпадает.'
      pageLoading.value = false
    } else {
      await navigateTo('/')
    }

    return
  }

  // Загружаем детали инвайта
  const { data, error } = await api.functions.getInvite({ token })

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

.auth-card {
  max-width: 400px;
}

.brand {
  margin-bottom: 32px;
}

.state {
  text-align: center;
}
</style>
