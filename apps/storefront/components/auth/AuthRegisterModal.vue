<template>
  <FsDialog v-model="modal.isOpen.value" title="Регистрация" size="sm">
    <FsForm class="register-root" @submit="onSubmit">
      <FsField label="Имя">
        <FsInput v-model="name" placeholder="Как вас зовут?" />
      </FsField>

      <FsField v-slot="{ hasError }" label="Email" required name="email" :model-value="email" :rules="[validationRules.email.required, validationRules.email.format]">
        <FsInput v-model="email" type="email" placeholder="email@example.com" :error="hasError" />
      </FsField>

      <FsField v-slot="{ hasError }" label="Пароль" required name="password" :model-value="password" :rules="[validationRules.password.required, validationRules.password.minLength]">
        <FsInput v-model="password" type="password" placeholder="Минимум 6 символов" :error="hasError" />
      </FsField>

      <FsField v-slot="{ hasError }" label="Подтвердите пароль" required name="confirmPassword" :model-value="confirmPassword" :rules="[validationRules.password.required, { type: 'custom', validator: (v) => v === password, message: 'Пароли не совпадают' }]">
        <FsInput v-model="confirmPassword" type="password" placeholder="Ещё раз" :error="hasError" />
      </FsField>

      <FsAlert v-if="serverError" type="error">{{ serverError }}</FsAlert>

      <FsButton type="submit" :loading="authStore.loading" block>
        Зарегистрироваться
      </FsButton>

      <div class="links">
        <button type="button" class="link" @click="toLogin">Уже есть аккаунт? Войти</button>
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
const modal = useModal('auth-register')

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const serverError = ref('')

function toLogin() { modal.close(); useModal('auth-login').open() }

async function onSubmit() {
  serverError.value = ''
  try {
    await authStore.register(name.value, email.value, password.value)
    modal.close()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } }
    serverError.value = fetchErr?.data?.message ?? 'Ошибка регистрации'
  }
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.links {
  text-align: center;
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
