<template>
  <div class="invite-root">
    <div class="card">
      <div class="logo">
        <UiAppLogo :size="32" />
        <span class="logo-text">Fastio</span>
      </div>

      <div v-if="pageLoading" class="state">
        <UiText size="small">Загружаем приглашение…</UiText>
      </div>

      <div v-else-if="fatalError" class="state">
        <UiAlert type="error">{{ fatalError }}</UiAlert>
      </div>

      <div v-else-if="success" class="state">
        <UiAlert type="success">Вы присоединились к команде {{ invite?.tenantName }}!</UiAlert>
        <UiButton
          type="primary"
          block
          style="margin-top: 16px"
          @click="navigateTo('/')"
        >
          Перейти в панель
        </UiButton>
      </div>

      <template v-else-if="invite">
        <UiTitle size="h4" class="title">Приглашение в команду</UiTitle>
        <UiText size="small" class="subtitle">
          Вас приглашают в <strong>{{ invite.tenantName }}</strong>
        </UiText>

        <UiSegmentedControl
          v-model="mode"
          :options="[{ label: 'Регистрация', value: 'register' }, { label: 'Войти', value: 'login' }]"
          class="mode-switcher"
        />

        <!-- Регистрация -->
        <UiForm v-if="mode === 'register'" :error="formError" @submit="handleRegister">
          <UiInput
            :model-value="invite.email"
            label="Email"
            :clearable="false"
            :disabled="true"
          />
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
          <UiButton
            submit
            type="primary"
            block
            :loading="submitting"
          >
            Создать аккаунт и присоединиться
          </UiButton>
        </UiForm>

        <!-- Вход -->
        <UiForm v-else :error="formError" @submit="handleLogin">
          <UiInput
            v-model="loginForm.email"
            name="email"
            label="Email"
            :clearable="false"
            :rules="[{ required: true, message: 'Введите email' }]"
          />
          <UiInput
            v-model="loginForm.password"
            name="password"
            label="Пароль"
            type="password"
            :clearable="false"
            :rules="[{ required: true, message: 'Введите пароль' }]"
          />
          <UiButton
            submit
            type="primary"
            block
            :loading="submitting"
          >
            Войти и присоединиться
          </UiButton>
        </UiForm>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { definePageMeta, useRoute, useNuxtApp, navigateTo } from '#imports'
import { UiButton, UiAlert, UiTitle, UiText, UiForm, UiInput, UiSegmentedControl } from '@fastio/ui'
import UiAppLogo from '~/components/ui/AppLogo.vue'

definePageMeta({ layout: false })

const route = useRoute()
const { $supabase } = useNuxtApp()

type InviteDetails = { email: string; role: string; tenantName: string }

const pageLoading = ref(true)
const submitting = ref(false)
const fatalError = ref('')
const formError = ref('')
const success = ref(false)
const invite = ref<InviteDetails | null>(null)
const mode = ref<'register' | 'login'>('register')

const token = route.query.token as string

const form = reactive({ name: '', password: '' })
const loginForm = reactive({ email: '', password: '' })

const acceptInvite = async () => {
  const { error } = await $supabase.functions.invoke('accept-invite', { body: { token } })

  if (error) throw new Error('Не удалось принять приглашение')
  success.value = true
}

const handleRegister = async () => {
  formError.value = ''
  submitting.value = true

  try {
    const appUrl = window.location.origin
    const { error: signUpError } = await $supabase.auth.signUp({
      email: invite.value!.email,
      password: form.password,
      options: {
        data: { full_name: form.name },
        emailRedirectTo: `${appUrl}/invite?token=${token}`,
      },
    })

    if (signUpError) {
      formError.value = signUpError.message

      return
    }

    // На локалке (autoconfirm=true) сессия есть сразу
    const { data: { session } } = await $supabase.auth.getSession()

    if (session) {
      await acceptInvite()
    } else {
      // Продакшн: нужно подтвердить email
      fatalError.value = 'Проверьте почту — мы отправили письмо для подтверждения регистрации'
    }
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Произошла ошибка'
  } finally {
    submitting.value = false
  }
}

const handleLogin = async () => {
  formError.value = ''
  submitting.value = true

  try {
    const { error: signInError } = await $supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    })

    if (signInError) {
      formError.value = 'Неверный email или пароль'

      return
    }

    await acceptInvite()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Произошла ошибка'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!token) {
    fatalError.value = 'Неверная ссылка приглашения'
    pageLoading.value = false

    return
  }

  // Если юзер уже авторизован — сразу принимаем инвайт
  const { data: { session } } = await $supabase.auth.getSession()

  if (session) {
    try {
      await acceptInvite()
    } catch {
      fatalError.value = 'Не удалось принять приглашение. Возможно, вы уже состоите в команде или email не совпадает.'
    }
    pageLoading.value = false

    return
  }

  // Загружаем детали инвайта
  const { data, error } = await $supabase.functions.invoke('get-invite', { body: { token } })

  if (error || data?.error) {
    const msg = data?.error ?? ''

    if (msg === 'Invitation already accepted') {
      fatalError.value = 'Это приглашение уже было принято'
    } else if (msg === 'Invitation expired') {
      fatalError.value = 'Срок действия приглашения истёк'
    } else {
      fatalError.value = 'Приглашение не найдено или недействительно'
    }
  } else {
    invite.value = data
    loginForm.email = data.email
  }

  pageLoading.value = false
})
</script>

<style scoped lang="scss">
.invite-root {
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
  margin: 0 0 4px;
}

.subtitle {
  display: block;
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}

.mode-switcher {
  margin-bottom: 20px;
}

.state {
  text-align: center;
}
</style>
