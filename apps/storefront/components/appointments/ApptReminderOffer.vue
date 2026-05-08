<template>
  <div class="reminder-root">
    <div class="reminder-header">
      <BellRing :size="20" class="reminder-icon" />
      <FsText variant="label" :weight="500">Напоминание в Telegram</FsText>
    </div>

    <template v-if="sent">
      <FsAlert type="success">
        Сообщение отправлено в Telegram — выберите удобное время напоминания прямо там.
      </FsAlert>
    </template>

    <template v-else-if="hasTelegram">
      <FsText variant="body-sm" color="secondary">Пришлём сообщение в Telegram, вы выберете за сколько напомнить.</FsText>
      <FsButton
        variant="outline"
        size="small"
        :loading="loading"
        :disabled="loading"
        @click="onOfferClick"
      >
        Настроить напоминание
      </FsButton>
      <FsAlert v-if="error" type="error" class="reminder-error">{{ error }}</FsAlert>
    </template>

    <template v-else-if="botUsername">
      <FsText variant="body-sm" color="secondary">Откройте бота — выберете за сколько напомнить.</FsText>
      <FsButton
        variant="outline"
        size="small"
        :loading="preparingLink"
        :disabled="preparingLink || !deepLinkUrl"
        as="a"
        :href="deepLinkUrl || '#'"
        target="_blank"
        rel="noopener"
      >
        Открыть в Telegram
      </FsButton>
      <FsAlert v-if="error" type="error" class="reminder-error">{{ error }}</FsAlert>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { BellRing } from 'lucide-vue-next'
import { FsAlert, FsButton, FsText } from '@fastio/public-ui'
import { useAuthStore } from '~/stores/auth'
import { useRuntimeConfig } from '#imports'
import { useSupabaseClient } from '~/composables/useSupabaseClient'

const props = defineProps<{
  appointmentId: string
}>()

const config = useRuntimeConfig()
const authStore = useAuthStore()
const { customer } = storeToRefs(authStore)

const hasTelegram = computed(() => !!customer.value?.telegramId)
const botUsername = computed(() => (config.public.telegramAuthBotUsername as string) || '')

const loading = ref(false)
const sent = ref(false)
const error = ref('')

const preparingLink = ref(false)
const deepLinkUrl = ref('')

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = useSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

const onOfferClick = async () => {
  loading.value = true
  error.value = ''
  try {
    await $fetch<{ ok: boolean }>('/api/appointments/remind-offer', {
      method: 'POST',
      body: { appointmentId: props.appointmentId },
      headers: await authHeaders(),
    })
    sent.value = true
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? 'Не удалось отправить сообщение'
  } finally {
    loading.value = false
  }
}

// Для гостей-без-tg готовим deep-link с одноразовым токеном при mount —
// чтобы кнопка «Открыть в Telegram» не делала круговой запрос на клик.
onMounted(async () => {
  if (hasTelegram.value || !botUsername.value) return

  preparingLink.value = true
  try {
    const { token } = await $fetch<{ token: string }>('/api/appointments/remind-token', {
      method: 'POST',
      body: { appointmentId: props.appointmentId },
      headers: await authHeaders(),
    })
    deepLinkUrl.value = `https://t.me/${botUsername.value}?start=remind_${token}`
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? 'Не удалось подготовить ссылку'
  } finally {
    preparingLink.value = false
  }
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.reminder-root {
  width: 100%;
  padding: 16px;
  background: var(--color-surface);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  @include flex-col(12px);
}

.reminder-header {
  @include flex-row(8px);
  align-items: center;
}

.reminder-icon {
  color: var(--primary);
  flex-shrink: 0;
}

.reminder-error {
  margin-top: 4px;
}
</style>
