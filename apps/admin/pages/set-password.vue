<template>
  <div class="set-password-root">
    <div class="card">
      <div class="logo">
        <UiAppLogo :size="32" />
        <span class="logo-text">Fastio</span>
      </div>

      <UiTitle size="h3" class="title">Установите пароль</UiTitle>
      <UiText size="small" class="subtitle">Введите имя и придумайте пароль для входа</UiText>

      <UiForm :error="error" @submit="handleSubmit">
        <UiInput
          v-model="form.name"
          name="name"
          label="Ваше имя"
          placeholder="Иван Иванов"
          :clearable="false"
          :rules="[{ required: true, message: 'Введите ваше имя' }]"
        />
        <UiInput
          v-model="form.password"
          name="password"
          label="Пароль"
          type="password"
          :clearable="false"
          :rules="[
            { required: true, message: 'Введите пароль' },
            { type: 'minLength', min: 6, message: 'Минимум 6 символов' },
          ]"
        />
        <UiInput
          v-model="form.passwordConfirm"
          name="passwordConfirm"
          label="Повторите пароль"
          type="password"
          :clearable="false"
          :rules="[
            { required: true, message: 'Повторите пароль' },
            { type: 'custom', validator: (val) => val === form.password, message: 'Пароли не совпадают' },
          ]"
        />
        <UiButton
          submit
          type="primary"
          block
          :loading="loading"
        >
          Сохранить и войти
        </UiButton>
      </UiForm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { definePageMeta, useNuxtApp, navigateTo } from '#imports'
import { UiForm, UiInput, UiButton, UiTitle, UiText } from '@fastio/ui'
import UiAppLogo from '~/components/ui/AppLogo.vue'

definePageMeta({ layout: false })

const { $supabase } = useNuxtApp()

const form = reactive({ name: '', password: '', passwordConfirm: '' })
const error = ref('')
const loading = ref(false)

const handleSubmit = async () => {
  error.value = ''
  loading.value = true

  const { error: updateError } = await $supabase.auth.updateUser({
    password: form.password,
    data: { full_name: form.name },
  })

  if (updateError) {
    error.value = 'Не удалось сохранить. Попробуйте ещё раз'
  } else {
    sessionStorage.removeItem('fastio:invite-pending')
    await navigateTo('/')
  }

  loading.value = false
}
</script>

<style scoped lang="scss">
.set-password-root {
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
  margin: 0 0 8px;
}

.subtitle {
  display: block;
  margin: 0 0 28px;
  color: var(--color-text-secondary);
}
</style>
