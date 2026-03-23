<template>
  <FsDialog v-model="modal.isOpen.value" title="Восстановление пароля" size="sm">
    <FsForm v-if="!sent" class="forgot-root" @submit="onSubmit">
      <FsText>Введите email, на который зарегистрирован аккаунт. Мы отправим ссылку для сброса пароля.</FsText>

      <FsField label="Email" required name="email" :model-value="email" :rules="[validationRules.email.required, validationRules.email.format]" v-slot="{ hasError }">
        <FsInput v-model="email" type="email" placeholder="email@example.com" :error="hasError" />
      </FsField>

      <FsAlert v-if="serverError" type="error">{{ serverError }}</FsAlert>

      <FsButton type="submit" :loading="loading" block>
        Отправить ссылку
      </FsButton>

      <button type="button" class="link" @click="toLogin">Вернуться ко входу</button>
    </FsForm>

    <div v-else class="forgot-root">
      <FsText>Ссылка для сброса пароля отправлена на {{ email }}. Проверьте почту.</FsText>
      <FsButton variant="outline" block @click="modal.close()">Закрыть</FsButton>
    </div>
  </FsDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { FsDialog, FsField, FsForm, FsInput, FsButton, FsText, FsAlert } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import { useModal } from '~/composables/useModal'

const modal = useModal('auth-forgot')

const email = ref('')
const serverError = ref('')
const loading = ref(false)
const sent = ref(false)

function toLogin() { modal.close(); useModal('auth-login').open() }

async function onSubmit() {
  serverError.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', { method: 'POST', body: { email: email.value } })
    sent.value = true
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } }
    serverError.value = fetchErr?.data?.message ?? 'Ошибка отправки'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.forgot-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.link {
  font-size: 14px;
  color: var(--primary);
  cursor: pointer;
  background: none;
  border: none;
  font: inherit;
  text-align: center;

  &:hover { text-decoration: underline; }
}
</style>
