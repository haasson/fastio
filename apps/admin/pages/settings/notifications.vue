<template>
  <UiForm @submit="handleSave">
    <div class="form">
      <UiSectionHeader title="Уведомления о заказах" />

      <div class="row">
        <div class="field">
          <UiInput
            v-model="form.email"
            name="email"
            label="Email для уведомлений"
            message="На этот адрес придёт письмо при каждом новом заказе"
            type="email"
            placeholder="orders@vasya-pizza.ru"
            :rules="[{ type: 'email', message: 'Некорректный email' }]"
          />
        </div>
      </div>

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

      <div class="footer">
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </div>
  </UiForm>

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
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { UiForm, UiInput, UiButton, UiText, UiIcon, UiSwitch, UiSectionHeader, UiModal, useMessage } from '@fastio/ui'
import { useNotificationPrefs } from '~/composables/data/useNotificationPrefs'
import { useTenantStore } from '~/stores/tenant'
import { useNuxtApp, useRuntimeConfig } from '#imports'
import { useConfirm } from '@fastio/kit'

const { blinkingCounter } = useNotificationPrefs()
const tenantStore = useTenantStore()
const { $supabase } = useNuxtApp()
const { success } = useMessage()
const { confirm } = useConfirm()

const form = reactive({
  email: tenantStore.tenant?.notifications?.email ?? '',
})

watch(() => tenantStore.tenant?.notifications, (n) => {
  form.email = n?.email ?? ''
})

const saving = ref(false)
const generating = ref(false)
const disconnecting = ref(false)
const showModal = ref(false)
const linkCode = ref('')
const polling = ref(false)
const connected = ref(false)

let pollInterval: ReturnType<typeof setInterval> | null = null

const botUsername = useRuntimeConfig().public.telegramBotUsername
const isTelegramConnected = computed(() => !!tenantStore.tenant?.notifications?.telegramChatId)
const chatTitle = computed(() => tenantStore.tenant?.notifications?.telegramChatTitle ?? null)

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

const handleSave = async () => {
  saving.value = true
  try {
    const current = tenantStore.tenant?.notifications

    await tenantStore.update({
      notifications: {
        email: form.email || null,
        telegramChatId: current?.telegramChatId ?? null,
        telegramThreadId: current?.telegramThreadId ?? null,
      },
    })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}

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
    const current = tenantStore.tenant?.notifications

    await tenantStore.update({
      notifications: {
        email: current?.email ?? null,
        telegramChatId: null,
        telegramThreadId: null,
        telegramChatTitle: null,
      },
    })
  } finally {
    disconnecting.value = false
  }
}

const copyCode = () => {
  navigator.clipboard.writeText(`/start ${linkCode.value}`)
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/form' as *;

.form {
  @include modal-form;
}

.row {
  display: flex;
  gap: 16px;

  .field {
    flex: 1;
    min-width: 0;
  }
}

.hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.prefs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pref {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.pref-label {
  font-weight: 500;
  margin-bottom: 2px;
  display: block;
}

.tg-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--color-bg-page);
  border-radius: 12px;
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
  font-size: 14px;
  font-weight: 600;
  color: var(--grey-800);
  margin-bottom: 2px;
}

.tg-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tg-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
  line-height: 1.6;

  p {
    margin: 0;
  }
}

.tg-code {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--color-bg-page);
  border-radius: 8px;

  code {
    flex: 1;
    font-size: 15px;
    font-family: monospace;
    user-select: all;
  }
}

.tg-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tg-waiting {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tg-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.tg-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 0;
  text-align: center;
}

.tg-success-icon {
  color: var(--color-success);
}

.tg-success-text {
  font-weight: 600;
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

.footer {
  @include settings-footer;
}
</style>
