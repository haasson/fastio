<template>
  <div class="set-password-root">
    <div class="card">
      <AppBrand class="brand" />

      <UiTitle size="h3" class="title">Установите пароль</UiTitle>
      <UiText size="small" class="subtitle">Введите имя и придумайте пароль для входа</UiText>

      <UiAlert v-if="emailConfirmSent" type="info" style="margin-bottom: 16px">
        Проверьте почту — отправили письмо для подтверждения регистрации
      </UiAlert>

      <UiForm v-if="!emailConfirmSent" :error="error" @submit="handleSubmit">
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
          {{ inviteToken ? 'Создать аккаунт и присоединиться' : 'Сохранить и войти' }}
        </UiButton>
      </UiForm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { definePageMeta, useRoute, navigateTo, useSupabaseApi } from '#imports'
import { UiForm, UiInput, UiButton, UiTitle, UiText, UiAlert } from '@fastio/ui'
import AppBrand from '~/components/ui/AppBrand.vue'

definePageMeta({ layout: false })

const api = useSupabaseApi()
const route = useRoute()

const inviteToken = route.query.token as string | undefined
const inviteEmail = route.query.email as string | undefined

const form = reactive({ name: '', password: '', passwordConfirm: '' })
const error = ref('')
const loading = ref(false)
const emailConfirmSent = ref(false)

const handleSubmit = async () => {
  error.value = ''
  loading.value = true

  // Инвайт нового юзера — нужно создать аккаунт
  if (inviteToken && inviteEmail) {
    const appUrl = window.location.origin
    const { error: signUpError } = await api.auth.signUp(inviteEmail, form.password, {
      data: { full_name: form.name },
      emailRedirectTo: `${appUrl}/set-password?token=${inviteToken}&email=${encodeURIComponent(inviteEmail)}`,
    })

    if (signUpError) {
      error.value = 'Не удалось создать аккаунт. Попробуйте ещё раз'
      loading.value = false

      return
    }

    const { data: { session } } = await api.auth.getSession()

    if (session) {
      await api.functions.acceptInvite({ token: inviteToken })
      sessionStorage.removeItem('fastio:invite-pending')
      await navigateTo('/')
    } else {
      // Продакшн: ждём подтверждения email
      emailConfirmSent.value = true
    }

    loading.value = false

    return
  }

  // Обычный флоу — юзер уже авторизован, просто устанавливает пароль
  const { error: updateError } = await api.auth.updateUser({
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

.brand {
  margin-bottom: 32px;
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
