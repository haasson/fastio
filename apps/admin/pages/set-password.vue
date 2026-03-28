<template>
  <div class="set-password-root">
    <UiCard size="large" class="auth-card">
      <AppBrand class="brand" />

      <UiTitle size="h3" class="title">{{ title }}</UiTitle>
      <UiText size="small" class="subtitle">{{ subtitle }}</UiText>

      <UiAlert v-if="emailConfirmSent" type="info" style="margin-bottom: 16px">
        Проверьте почту — отправили письмо для подтверждения регистрации
      </UiAlert>

      <UiForm v-if="!emailConfirmSent" :error="error" @submit="handleSubmit">
        <UiInput
          v-if="showNameField"
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
          {{ buttonText }}
        </UiButton>
      </UiForm>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { definePageMeta, useRoute, navigateTo } from '#imports'
import { useDatabase } from '~/composables/data/useDatabase'
import { UiCard, UiForm, UiInput, UiButton, UiTitle, UiText, UiAlert } from '@fastio/ui'
import AppBrand from '~/components/ui/AppBrand.vue'
import { INVITE_PENDING_KEY, RECOVERY_PENDING_KEY } from '~/utils/constants'

definePageMeta({ layout: false })

const api = useDatabase()
const route = useRoute()

const inviteToken = route.query.token as string | undefined
const inviteEmail = route.query.email as string | undefined
const isRecovery = !!sessionStorage.getItem(RECOVERY_PENDING_KEY)

const form = reactive({ name: '', password: '', passwordConfirm: '' })
const error = ref('')
const loading = ref(false)
const emailConfirmSent = ref(false)

const showNameField = computed(() => !isRecovery)

const title = computed(() => {
  if (isRecovery) return 'Новый пароль'

  return 'Установите пароль'
})

const subtitle = computed(() => {
  if (isRecovery) return 'Придумайте новый пароль для входа'

  return 'Введите имя и придумайте пароль для входа'
})

const buttonText = computed(() => {
  if (isRecovery) return 'Сохранить пароль'
  if (inviteToken) return 'Создать аккаунт и присоединиться'

  return 'Сохранить и войти'
})

const handleSubmit = async () => {
  error.value = ''
  loading.value = true

  // Восстановление пароля — юзер уже авторизован через recovery-ссылку
  if (isRecovery) {
    const { error: updateError } = await api.auth.updateUser({ password: form.password })

    if (updateError) {
      error.value = 'Не удалось сохранить. Попробуйте ещё раз'
    } else {
      sessionStorage.removeItem(RECOVERY_PENDING_KEY)
      await navigateTo('/')
    }

    loading.value = false

    return
  }

  // Инвайт нового юзера — нужно создать аккаунт
  if (inviteToken && inviteEmail) {
    // Проверяем: вдруг юзер уже авторизован (вернулся по confirmation-ссылке)
    const { data: { session } } = await api.auth.getSession()

    if (session) {
      await api.auth.updateUser({ data: { full_name: form.name } })
      await api.functions.acceptInvite({ token: inviteToken })
      sessionStorage.removeItem(INVITE_PENDING_KEY)
      await navigateTo('/')
      loading.value = false

      return
    }

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

    const { data: { session: newSession } } = await api.auth.getSession()

    if (newSession) {
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
