<template>
  <div class="set-password-root">
    <UiCard size="large" class="auth-card">
      <AppBrand class="brand" />

      <UiTitle size="h3" class="title">{{ title }}</UiTitle>
      <UiText size="small" class="subtitle">{{ subtitle }}</UiText>

      <UiForm :error="error" @submit="handleSubmit">
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
        <UiCheckbox
          v-if="isTenant"
          v-model:checked="form.agreed"
          name="agreed"
          :rules="[{ type: 'custom', validator: (val) => val === true, message: 'Необходимо принять условия' }]"
        >
          Принимаю
          <a href="/legal/oferta" target="_blank" class="doc-link">оферту</a>
          и
          <a href="/legal/privacy" target="_blank" class="doc-link">политику конфиденциальности</a>
          FastIO
        </UiCheckbox>

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
import { useDatabase } from '~/shared/data/useDatabase'
import { UiCard, UiForm, UiInput, UiButton, UiTitle, UiText, UiCheckbox } from '@fastio/ui'
import AppBrand from '~/shared/ui/components/AppBrand.vue'
import { INVITE_PENDING_KEY, RECOVERY_PENDING_KEY } from '~/shared/utils/constants'

definePageMeta({ layout: false })

const api = useDatabase()
const route = useRoute()

const inviteToken = route.query.token as string | undefined
const inviteEmail = route.query.email as string | undefined
const isRecovery = !!sessionStorage.getItem(RECOVERY_PENDING_KEY)

const form = reactive({ name: '', password: '', passwordConfirm: '', agreed: false })
const error = ref('')
const loading = ref(false)

const isInvite = !!(inviteToken && inviteEmail)
const isTenant = !isRecovery && !isInvite
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
      // Hard-reload: см. комментарий в login.vue.
      window.location.href = '/'
    }

    loading.value = false

    return
  }

  // Инвайт нового юзера — нужно создать аккаунт
  if (inviteToken && inviteEmail) {
    // Если юзер уже залогинен (например, владелец принимает invite в чужой
    // tenant) — accept-invite обрабатывает authenticated-mode.
    const { data: { session } } = await api.auth.getSession()

    if (session) {
      await api.auth.updateUser({ data: { full_name: form.name } })
      await api.functions.acceptInvite({ token: inviteToken })
      sessionStorage.removeItem(INVITE_PENDING_KEY)
      window.location.href = '/'

      return
    }

    // Unauthenticated: server создаёт user через admin API + accept invitation.
    // client-side signUp удалён (PREPROD-099 follow-up) — disable signup в GoTrue
    // не сломает этот flow, потому что admin.createUser работает service-role.
    const { error: acceptError } = await api.functions.acceptInvite({
      token: inviteToken,
      password: form.password,
      fullName: form.name,
    })

    if (acceptError) {
      error.value = 'Не удалось создать аккаунт. Попробуйте ещё раз'
      loading.value = false

      return
    }

    // Логиним свежесозданного юзера обычным паролем (signIn не блокируется
    // GOTRUE_DISABLE_SIGNUP).
    const { error: signInError } = await api.auth.signIn(inviteEmail, form.password)

    if (signInError) {
      error.value = 'Аккаунт создан, но не удалось войти. Попробуйте на странице входа.'
      loading.value = false

      return
    }

    sessionStorage.removeItem(INVITE_PENDING_KEY)
    window.location.href = '/'

    return
  }

  // Обычный флоу — юзер уже авторизован, просто устанавливает пароль
  const { error: updateError } = await api.auth.updateUser({
    password: form.password,
    data: { full_name: form.name },
  })

  if (updateError) {
    error.value = 'Не удалось сохранить. Попробуйте ещё раз'
    loading.value = false
  } else {
    sessionStorage.removeItem(INVITE_PENDING_KEY)
    window.location.href = '/'
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.set-password-root {
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
  margin: 0 0 var(--space-8);
}

.subtitle {
  display: block;
  margin: 0 0 var(--space-24);
  color: var(--color-text-secondary);
}

.doc-link {
  color: var(--color-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}
</style>
