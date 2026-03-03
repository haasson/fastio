<template>
  <div class="login-root">
    <div class="card">
      <div class="logo">
        <UiAppLogo :size="32" />
        <span class="logo-text">Fastio</span>
      </div>

      <UiTitle size="h3" class="title">Вход в панель управления</UiTitle>

      <form class="form" @submit.prevent="handleSubmit">
        <UiInput
          v-model="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          :clearable="false"
        />

        <UiInput
          v-model="password"
          label="Пароль"
          type="password"
          :clearable="false"
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
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { definePageMeta, useNuxtApp, useRoute, navigateTo } from '#imports'
import { UiInput, UiButton, UiAlert, UiTitle } from '@fastio/ui'
import UiAppLogo from '~/components/ui/AppLogo.vue'

definePageMeta({ layout: false })

const { $supabase } = useNuxtApp()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

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
