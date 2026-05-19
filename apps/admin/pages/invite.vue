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
import { useDatabase } from '~/shared/data/useDatabase'
import { UiCard, UiAlert, UiText } from '@fastio/ui'
import AppBrand from '~/shared/ui/components/AppBrand.vue'

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
      // Hard-reload: после accept-invite смена tenant'а / прав требует
      // полной переинициализации store'ов и channels.
      window.location.href = '/'
    }

    return
  }

  // Загружаем детали инвайта.
  // Edge function возвращает унифицированный envelope:
  //   200 → { success: true, email, roleName, tenantName, userExists }
  //   4xx/5xx → { success: false, error, code } — supabase-js кидает в `error`,
  //   body доступен через context.json().
  const { data, error } = await api.functions.getInvite({ token })

  let code: string | null = null

  if (error) {
    try {
      const body = await (error as {
        context?: { json?: () => Promise<{ code?: string }> }
      }).context?.json?.()

      code = body?.code ?? null
    } catch { /* ignore parse errors */ }
  }

  if (error || !data?.success) {
    if (code === 'already_accepted') {
      fatalError.value = 'Это приглашение уже было принято'
    } else if (code === 'expired') {
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
@use '@fastio/styles/mixins/layout' as *;

.invite-root {
  @include flex-center;
  min-height: 100vh;
  background: var(--color-bg-page);
  padding: var(--space-16);
}

.auth-card {
  max-width: 400px;
}

.brand {
  margin-bottom: var(--space-32);
}

.state {
  text-align: center;
}
</style>
