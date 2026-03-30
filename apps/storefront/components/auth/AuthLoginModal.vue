<template>
  <FsDialog v-model="modal.isOpen.value" title="Вход" size="sm">
    <FsForm class="login-root" @submit="onSubmit">
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

      <div class="links">
        <button type="button" class="link" @click="toRegister">Создать аккаунт</button>
        <button type="button" class="link" @click="toForgot">Забыли пароль?</button>
      </div>
    </FsForm>
  </FsDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FsDialog, FsField, FsForm, FsInput, FsButton, FsAlert } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import { useAuthStore } from '~/stores/auth'
import { useModal } from '~/composables/useModal'

const authStore = useAuthStore()
const modal = useModal('auth-login')

const email = ref('')
const password = ref('')
const serverError = ref('')
const notRegistered = ref(false)

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
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.login-root {
  // gap handled by FsForm
}

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
</style>
