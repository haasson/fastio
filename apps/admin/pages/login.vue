<template>
  <div class="login-root">
    <div class="card">
      <div class="logo">
        <span class="logo-icon">🍔</span>
        <span class="logo-text">FastFood SaaS</span>
      </div>

      <h1 class="title">Вход в панель управления</h1>

      <form class="form" @submit.prevent="handleSubmit">
        <div class="field">
          <label class="label" for="email">Email</label>
          <input
            id="email"
            v-model="email"
            class="input"
            type="email"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />
        </div>

        <div class="field">
          <label class="label" for="password">Пароль</label>
          <input
            id="password"
            v-model="password"
            class="input"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="submit" type="submit" :disabled="loading">
          <span v-if="loading" class="spinner" />
          <span v-else>Войти</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
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

.logo-icon {
  font-size: 28px;
}

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
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.input {
  height: 44px;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 0 14px;
  font-size: 15px;
  color: #111;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: #ff6b35;
}

.error {
  font-size: 13px;
  color: #e53935;
  margin: 0;
  padding: 10px 12px;
  background: #ffeaea;
  border-radius: 8px;
}

.submit {
  height: 48px;
  background: #ff6b35;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, opacity 0.15s;
  margin-top: 4px;
}

.submit:hover:not(:disabled) {
  background: #e55a25;
}

.submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
