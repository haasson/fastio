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
            type="email"
            placeholder="orders@vasya-pizza.ru"
            :rules="[{ type: 'email', message: 'Некорректный email' }]"
          />
          <span class="hint">На этот адрес придёт письмо при каждом новом заказе</span>
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
        <span class="tg-icon"><UiIcon name="messageCircle" :size="28" /></span>
        <div class="tg-info">
          <UiText size="small" class="tg-title">Уведомления в Telegram</UiText>
          <UiText size="tiny" class="tg-desc">
            <template v-if="isTelegramConnected">Группа подключена — заказы будут приходить туда</template>
            <template v-else>Подключи группу — бот будет писать туда при каждом новом заказе</template>
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

  <UiModal v-model="showModal" title="Подключить Telegram" :width="440">
    <div class="tg-steps">
      <p>1. Создай Telegram-группу и добавь в неё <b>@{{ botUsername }}</b></p>
      <p>2. Отправь в группу эту команду:</p>
      <div class="tg-code">
        <code>/start {{ linkCode }}</code>
        <UiButton size="small" @click="copyCode">Скопировать</UiButton>
      </div>
      <p class="tg-hint">Код действует 15 минут</p>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { UiForm, UiInput, UiButton, UiText, UiIcon, UiSwitch, UiSectionHeader, UiModal, useMessage } from '@fastio/ui'
import { useNotificationPrefs } from '~/composables/data/useNotificationPrefs'
import { useTenantStore } from '~/stores/tenant'
import { useNuxtApp, useRuntimeConfig } from '#imports'

const { blinkingCounter } = useNotificationPrefs()
const tenantStore = useTenantStore()
const { $supabase } = useNuxtApp()
const { success } = useMessage()

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

const botUsername = useRuntimeConfig().public.telegramBotUsername
const isTelegramConnected = computed(() => !!tenantStore.tenant?.notifications?.telegramChatId)

const handleSave = async () => {
  saving.value = true
  try {
    await tenantStore.update({
      notifications: {
        ...(tenantStore.tenant?.notifications ?? {}),
        email: form.email || null,
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
    showModal.value = true
  } finally {
    generating.value = false
  }
}

const disconnectTelegram = async () => {
  disconnecting.value = true
  try {
    await tenantStore.update({
      notifications: {
        ...(tenantStore.tenant?.notifications ?? {}),
        telegramChatId: null,
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

.tg-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.footer {
  @include settings-footer;
}
</style>
