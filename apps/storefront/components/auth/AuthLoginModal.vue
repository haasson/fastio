<template>
  <FsDialog v-model="modal.isOpen.value" title="Вход" size="sm">
    <FsForm @submit="onSubmit">
      <FsField v-slot="{ hasError }" label="Email" required name="email" :model-value="email" :rules="[validationRules.email.required, validationRules.email.format]">
        <FsInput v-model="email" type="email" placeholder="email@example.com" :error="hasError" />
      </FsField>

      <FsField v-slot="{ hasError }" label="Пароль" required name="password" :model-value="password" :rules="[validationRules.password.required]">
        <FsInput v-model="password" type="password" placeholder="Пароль" :error="hasError" />
      </FsField>

      <FsAlert v-if="serverError" type="error">{{ serverError }}</FsAlert>

      <FsButton type="submit" :loading="authStore.loading" block>
        Войти
      </FsButton>

      <FsButton v-if="notRegistered" type="button" variant="outline" block @click="toRegister">
        Зарегистрироваться
      </FsButton>

      <template v-if="telegramEnabled">
        <div class="divider"><span>или</span></div>

        <FsAlert v-if="telegramError" type="error">{{ telegramError }}</FsAlert>

        <AuthTelegramWidget @auth="onTelegramAuth" />
      </template>

      <div class="links">
        <button type="button" class="link" @click="toRegister">Создать аккаунт</button>
        <button type="button" class="link" @click="toForgot">Забыли пароль?</button>
      </div>
    </FsForm>
  </FsDialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { FsDialog, FsField, FsForm, FsInput, FsButton, FsAlert } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import { useRuntimeConfig } from '#imports'
import { useAuthStore } from '~/stores/auth'
import { useModal } from '~/composables/useModal'
import { reportError } from '~/utils/reportError'
import AuthTelegramWidget from '~/components/auth/AuthTelegramWidget.vue'

const authStore = useAuthStore()
const modal = useModal('auth-login')
const config = useRuntimeConfig()

const email = ref('')
const password = ref('')
const serverError = ref('')
const telegramError = ref('')
const notRegistered = ref(false)

const telegramEnabled = computed(() => !!config.public.telegramAuthBotUsername)

function toRegister() { modal.close(); useModal('auth-register').open() }
function toForgot() { modal.close(); useModal('auth-forgot').open() }

async function onSubmit() {
  serverError.value = ''
  notRegistered.value = false
  try {
    await authStore.login(email.value, password.value)
    modal.close()
  } catch (err: unknown) {
    const fetchErr = err as { status?: number; data?: { message?: string } }
    serverError.value = fetchErr?.data?.message ?? 'Ошибка входа'
    notRegistered.value = fetchErr?.status === 403
  }
}

async function onTelegramAuth(data: Record<string, string>) {
  telegramError.value = ''
  try {
    await $fetch('/api/auth/telegram/login', { method: 'POST', body: data })
    await authStore.loginWithTelegram()
    modal.close()
  } catch (err) {
    reportError(err)
    telegramError.value = 'Не удалось войти через Telegram. Попробуйте ещё раз.'
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.links {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.link {
  @include text-caption;
  color: var(--primary);
  cursor: pointer;
  background: none;
  border: none;
  font: inherit;

  &:hover { text-decoration: underline; }
}

.divider {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 13px;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }
}
</style>
