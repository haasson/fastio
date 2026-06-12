<template>
  <FsDialog v-model="modal.isOpen.value" title="Вход" size="sm">
    <div class="login-root">
      <FsAlert v-if="!legalInfoComplete" type="info">
        Вход временно недоступен — заведение не заполнило юридические данные.
      </FsAlert>

      <template v-else-if="!telegramEnabled">
        <FsAlert type="warning">
          Вход через Telegram не настроен. Сообщите администратору заведения.
        </FsAlert>
      </template>

      <template v-else>
        <FsText variant="body-sm" color="secondary">
          Для входа в аккаунт используйте Telegram — это безопасно и не требует регистрации.
        </FsText>

        <AuthTelegramButton @done="onTelegramDone" />

        <p class="consent-note">
          Продолжая, вы соглашаетесь с
          <a href="/privacy" target="_blank">обработкой персональных данных</a>
        </p>
      </template>
    </div>
  </FsDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FsDialog, FsAlert, FsText } from '@fastio/public-ui'
import { useRuntimeConfig } from '#imports'
import { useAuthStore } from '../stores/auth'
import { useModal } from '~/shared/composables/useModal'
import useLegalCompliance from '~/shared/composables/useLegalCompliance'
import AuthTelegramButton from './AuthTelegramButton.vue'

const authStore = useAuthStore()
const modal = useModal('auth-login')
const config = useRuntimeConfig()
const { legalInfoComplete } = useLegalCompliance()

const telegramEnabled = computed(() => !!config.public.telegramClientBotUsername)

async function onTelegramDone() {
  await authStore.loginWithTelegram()
  modal.close()
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.login-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.consent-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-text-secondary);
  text-align: center;

  a {
    color: var(--primary);
    text-decoration: underline;
  }
}
</style>
