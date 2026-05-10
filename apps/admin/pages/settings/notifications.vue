<template>
  <div class="root">
    <UiCard size="large" class="section">
      <UiSectionHeader title="Браузерные уведомления" />

      <div class="prefs">
        <div class="pref">
          <div>
            <UiText size="small" class="pref-label">Мигающий счётчик в меню</UiText>
            <span class="hint">Счётчик новых заказов будет мигать в боковом меню</span>
          </div>
          <UiSwitch v-model="blinkingCounter" />
        </div>
      </div>
    </UiCard>

    <UiCard v-if="gate.telegramNotifications.value.enabled" size="large" class="section">
      <UiSectionHeader title="Telegram" />

      <div class="tg-block">
        <span class="tg-icon">
          <UiIcon name="messageCircle" :size="28" />
        </span>
        <div class="tg-info">
          <UiText size="small" class="tg-title">Уведомления в Telegram</UiText>
          <UiText size="tiny" class="tg-desc">
            <template v-if="isTelegramConnected">
              {{ chatTitle ? `Подключена группа «${chatTitle}»` : 'Группа подключена' }} — заказы и бронирования будут приходить туда
            </template>
            <template v-else>Подключи группу — бот будет писать туда при каждом новом заказе или бронировании</template>
          </UiText>
        </div>
        <UiButton
          v-if="isTelegramConnected"
          size="small"
          :loading="disconnecting"
          @click="disconnectTelegram"
        >
          Отключить
        </UiButton>
        <UiButton
          v-else
          size="small"
          type="primary"
          :loading="generating"
          @click="connectTelegram"
        >
          Подключить
        </UiButton>
      </div>
    </UiCard>
  </div>

  <UiModal
    v-model="showModal"
    title="Подключить Telegram"
    :width="440"
    :closable="!polling"
  >
    <div class="tg-steps">
      <template v-if="!connected">
        <p>1. Создай Telegram-группу (обычную или с топиками) и добавь в неё бота <b>@{{ botUsername }}</b></p>
        <p>2. Назначь бота <b>администратором</b> группы — иначе он не сможет читать сообщения. Остальные права можно не давать</p>
        <p>3. Отправь в группу эту команду (можно в любой топик):</p>
        <div class="tg-code">
          <code>/start {{ linkCode }}</code>
          <UiButton size="small" @click="copyCode">Скопировать</UiButton>
        </div>
        <div class="tg-status-row">
          <span v-if="polling" class="tg-waiting">
            <span class="spinner" />
            Ожидаем подключения...
          </span>
          <span class="tg-hint">Код действует 15 минут</span>
        </div>
      </template>
      <template v-else>
        <div class="tg-success">
          <UiIcon name="checkRound" :size="32" class="tg-success-icon" />
          <UiText size="small" class="tg-success-text">Группа успешно подключена!</UiText>
          <UiText size="tiny" class="tg-desc">Теперь сюда будут приходить уведомления о новых заказах и бронированиях</UiText>
        </div>
      </template>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { UiCard, UiButton, UiText, UiIcon, UiSwitch, UiSectionHeader, UiModal, useMessage } from '@fastio/ui'
import { useNotificationPrefs } from '~/features/settings'
import { useTenantStore } from '~/shared/stores/tenant'
import { useGate } from '~/shared/plan/useGate'
import { useNuxtApp, useRuntimeConfig } from '#imports'
import { useConfirm } from '@fastio/kit'

const { blinkingCounter } = useNotificationPrefs()
const tenantStore = useTenantStore()
const gate = useGate()
const { $supabase } = useNuxtApp()
const { confirm } = useConfirm()
const { success } = useMessage()

const generating = ref(false)
const disconnecting = ref(false)
const showModal = ref(false)
const linkCode = ref('')
const polling = ref(false)
const connected = ref(false)

let pollInterval: ReturnType<typeof setInterval> | null = null

const botUsername = useRuntimeConfig().public.telegramBotUsername
const isTelegramConnected = computed(() => !!tenantStore.tenant.notifications?.telegramChatId)
const chatTitle = computed(() => tenantStore.tenant.notifications?.telegramChatTitle ?? null)

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  polling.value = false
}

const startPolling = () => {
  polling.value = true
  pollInterval = setInterval(async () => {
    const { data } = await $supabase
      .from('tenants')
      .select('notifications')
      .eq('id', tenantStore.currentTenantId)
      .single()

    if (data?.notifications?.telegramChatId) {
      stopPolling()
      connected.value = true
      await tenantStore.fetchTenant()
      setTimeout(() => {
        showModal.value = false
      }, 2000)
    }
  }, 3000)
}

watch(showModal, (open) => {
  if (!open) {
    stopPolling()
    connected.value = false
  }
})

onUnmounted(() => stopPolling())

const connectTelegram = async () => {
  generating.value = true
  try {
    const code = Math.random().toString(36).slice(2, 10)

    await $supabase
      .from('telegram_link_codes')
      .upsert({ code, tenant_id: tenantStore.currentTenantId }, { onConflict: 'tenant_id' })
    linkCode.value = code
    connected.value = false
    showModal.value = true
    startPolling()
  } finally {
    generating.value = false
  }
}

const disconnectTelegram = async () => {
  const title = chatTitle.value
  const ok = await confirm({
    title: 'Отключить Telegram?',
    message: title
      ? `Группа «${title}» будет отключена. Уведомления о заказах и бронированиях перестанут приходить.`
      : 'Группа будет отключена. Уведомления о заказах и бронированиях перестанут приходить.',
    confirmText: 'Отключить',
    confirmType: 'error',
  })

  if (!ok) return

  disconnecting.value = true
  try {
    const current = tenantStore.tenant.notifications

    await tenantStore.update({
      notifications: {
        email: current?.email ?? null,
        telegramChatId: null,
        telegramThreadId: null,
        telegramChatTitle: null,
      },
    })
    success('Telegram отключён')
  } finally {
    disconnecting.value = false
  }
}

const copyCode = () => {
  navigator.clipboard.writeText(`/start ${linkCode.value}`)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.root {
  @include flex-col(var(--space-12));
  max-width: 680px;
}

.section {
  gap: var(--space-16);
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-loose);
}

.prefs {
  @include flex-col(var(--space-12));
}

.pref {
  @include flex-between(var(--space-16));
}

.pref-label {
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-4);
  display: block;
}

.tg-block {
  @include flex-row(var(--space-12));
  padding: var(--space-12);
  background: var(--color-bg-page);
  border-radius: var(--radius-12);
}

.tg-icon {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
}

.tg-info {
  flex: 1;
  min-width: 0;
}

.tg-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--grey-800);
  margin-bottom: var(--space-4);
}

.tg-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.tg-steps {
  @include flex-col(var(--space-12));
  font-size: var(--font-size-md);
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  line-height: 1.6;

  p {
    margin: 0;
  }
}

.tg-code {
  @include flex-row;
  padding: var(--space-8) var(--space-12);
  background: var(--color-bg-page);
  border-radius: var(--radius-8);

  code {
    flex: 1;
    font-size: var(--font-size-md);
    font-family: monospace;
    user-select: all;
  }
}

.tg-status-row {
  @include flex-between;
}

.tg-waiting {
  @include flex-row;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.tg-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.tg-success {
  @include flex-col;
  align-items: center;
  padding: var(--space-16) 0;
  text-align: center;
}

.tg-success-icon {
  color: var(--color-success);
}

.tg-success-text {
  font-weight: var(--font-weight-semibold);
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-text-secondary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
