<template>
  <div class="login-root">
    <UiCard size="large" class="auth-card">
      <AppBrand class="brand" />

      <template v-if="hashError">
        <UiTitle size="h3" class="title">Ссылка недействительна</UiTitle>
        <UiSpace :size="16" vertical>
          <UiAlert type="error">{{ hashError }}</UiAlert>
          <UiButton type="primary" block @click="hashError = ''">Войти по паролю</UiButton>
        </UiSpace>
      </template>

      <template v-else>
        <UiTitle size="h3" class="title">Вход в панель управления</UiTitle>

        <UiForm class="form" @submit="handleSubmit">
          <UiInput
            v-model="email"
            name="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            :clearable="false"
            :rules="[{ type: 'required', message: 'Введите email' }, { type: 'email', message: 'Некорректный email' }]"
          />

          <UiInput
            v-model="password"
            name="password"
            label="Пароль"
            type="password"
            :clearable="false"
            :rules="[{ type: 'required', message: 'Введите пароль' }]"
          />

          <UiAlert v-if="error" type="error">{{ error }}</UiAlert>

          <UiButton
            submit
            type="primary"
            block
            :loading="loading"
          >
            Войти
          </UiButton>
        </UiForm>
      </template>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { definePageMeta, useRoute, navigateTo, useSupabaseApi } from '#imports'
import { UiCard, UiForm, UiInput, UiButton, UiAlert, UiTitle, UiSpace } from '@fastio/ui'
import AppBrand from '~/components/ui/AppBrand.vue'

definePageMeta({ layout: false })

const api = useSupabaseApi()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const hashError = ref('')

const inviteToken = route.query.token as string | undefined

onMounted(() => {
  const hash = window.location.hash.slice(1)

  if (!hash) return

  const params = new URLSearchParams(hash)
  const errorCode = params.get('error_code')
  const errorParam = params.get('error')

  if (errorCode === 'otp_expired') {
    hashError.value = 'Ссылка из письма устарела. Запросите новое приглашение или войдите по паролю.'
  } else if (errorParam) {
    hashError.value = 'Ссылка недействительна. Войдите с паролем или запросите новую ссылку.'
  }

  history.replaceState(null, '', window.location.pathname + window.location.search)
})

const handleSubmit = async () => {
  error.value = ''
  loading.value = true

  const { error: authError } = await api.auth.signIn(email.value, password.value)

  if (authError) {
    error.value = authError.message === 'Invalid login credentials'
      ? 'Неверный email или пароль'
      : 'Произошла ошибка. Попробуйте ещё раз'
  } else {
    if (inviteToken) {
      await api.functions.acceptInvite({ token: inviteToken })
    }

    await navigateTo('/')
  }

  loading.value = false
}
</script>

<style scoped lang="scss">
.login-root {
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

.title {
  margin: 0 0 28px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
