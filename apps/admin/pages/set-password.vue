<template>
  <div class="set-password-root">
    <UiCard size="large" class="auth-card">
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
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { definePageMeta, useRoute, navigateTo } from '#imports'
import { useDatabase } from '~/composables/data/useDatabase'
import { UiCard, UiForm, UiInput, UiButton, UiTitle, UiText, UiAlert } from '@fastio/ui'
import AppBrand from '~/components/ui/AppBrand.vue'
import { INVITE_PENDING_KEY } from '~/utils/constants'

definePageMeta({ layout: false })

const api = useDatabase()
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
      sessionStorage.removeItem(INVITE_PENDING_KEY)
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
    sessionStorage.removeItem(INVITE_PENDING_KEY)
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

.auth-card {
  max-width: 400px;
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
