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

      <template v-else-if="forgotMode">
        <UiTitle size="h3" class="title">Восстановление пароля</UiTitle>

        <template v-if="resetSent">
          <UiAlert type="info">Ссылка для сброса пароля отправлена на {{ resetEmail }}. Проверьте почту.</UiAlert>
          <UiButton style="margin-top: var(--space-16)" block @click="forgotMode = false">Назад к входу</UiButton>
        </template>

        <UiForm
          v-else
          class="form"
          :error="resetError"
          @submit="handleReset"
        >
          <UiInput
            v-model="resetEmail"
            name="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            :clearable="false"
            :rules="[{ type: 'required', message: 'Введите email' }, { type: 'email', message: 'Некорректный email' }]"
          />
          <UiButton
            submit
            type="primary"
            block
            :loading="resetLoading"
          >Отправить ссылку</UiButton>
          <UiButton block @click="forgotMode = false">Назад</UiButton>
        </UiForm>
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

          <UiButton block @click="forgotMode = true">Забыли пароль?</UiButton>
        </UiForm>
      </template>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { definePageMeta, useRoute, navigateTo } from '#imports'
import { useDatabase } from '~/composables/data/useDatabase'
import { UiCard, UiForm, UiInput, UiButton, UiAlert, UiTitle, UiSpace } from '@fastio/ui'
import AppBrand from '~/components/ui/AppBrand.vue'

definePageMeta({ layout: false })

const api = useDatabase()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const hashError = ref('')

const forgotMode = ref(false)
const resetEmail = ref('')
const resetError = ref('')
const resetLoading = ref(false)
const resetSent = ref(false)

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

const handleReset = async () => {
  resetError.value = ''
  resetLoading.value = true

  const appUrl = window.location.origin
  const { error: err } = await api.functions.sendRecoveryEmail({
    email: resetEmail.value,
    redirectTo: `${appUrl}/set-password`,
  })

  if (err) {
    resetError.value = 'Не удалось отправить письмо. Попробуйте ещё раз.'
  } else {
    resetSent.value = true
  }

  resetLoading.value = false
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;
@use '@fastio/styles/mixins/layout' as *;

.login-root {
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

.title {
  margin: 0 0 var(--space-24);
}

.form {
  @include modal-form;
}
</style>
