<template>
  <div class="login-root">
    <div class="card">
      <div class="logo">
        <span class="logo-icon">🍔</span>
        <span class="logo-text">FastFood SaaS</span>
      </div>

      <h1 class="title">Вход в панель управления</h1>

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

        <UiButton submit type="primary" block :loading="loading">
          Войти
        </UiButton>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiInput, UiButton, UiAlert } from '@fastfood-saas/ui'
import { signInWithEmailAndPassword } from 'firebase/auth'

definePageMeta({ layout: false })

const { $auth } = useNuxtApp()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

const errorMessages: Record<string, string> = {
  'auth/invalid-credential': 'Неверный email или пароль',
  'auth/user-not-found': 'Пользователь не найден',
  'auth/wrong-password': 'Неверный пароль',
  'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже',
}

async function handleSubmit() {
  error.value = ''
  loading.value = true

  try {
    await signInWithEmailAndPassword($auth, email.value, password.value)
    await navigateTo('/')
  } catch (e: unknown) {
    const code = (e as { code?: string }).code ?? ''
    error.value = errorMessages[code] ?? 'Произошла ошибка. Попробуйте ещё раз'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 16px;
}

.card {
  background: #fff;
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

.logo-icon { font-size: 28px; }

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: #111;
}

.title {
  font-size: 22px;
  font-weight: 700;
  color: #111;
  margin: 0 0 28px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
