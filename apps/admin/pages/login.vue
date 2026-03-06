<template>
  <div class="login-root">
    <div class="card">
      <div class="logo">
        <UiAppLogo :size="32" />
        <span class="logo-text">Fastio</span>
      </div>

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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { definePageMeta, useNuxtApp, useRoute, navigateTo } from '#imports'
import { UiForm, UiInput, UiButton, UiAlert, UiTitle, UiSpace } from '@fastio/ui'
import UiAppLogo from '~/components/ui/AppLogo.vue'

definePageMeta({ layout: false })

const { $supabase } = useNuxtApp()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const hashError = ref('')

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

  const { error: authError } = await $supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  if (authError) {
    error.value = authError.message === 'Invalid login credentials'
      ? 'Неверный email или пароль'
      : 'Произошла ошибка. Попробуйте ещё раз'
  } else {
    const redirect = route.query.redirect as string

    await navigateTo(redirect || '/')
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

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-title);
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
