<template>
  <UiForm @submit="handleSave">
    <div class="form">
      <UiText size="tiny" span class="section-title">Уведомления о заказах</UiText>

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

      <div class="field">
        <UiInput
          v-model="form.telegramChatId"
          label="Telegram Chat ID"
          placeholder="-1001234567890"
        />
        <span class="hint">
          Как получить:
          <UiLink
            size="small"
            href="https://t.me/userinfobot"
            target="_blank"
            rel="noopener"
          >@userinfobot</UiLink>
          (для личных сообщений) или добавьте бота в группу и используйте ID группы
        </span>
      </div>

      <div class="tg-status">
        <span class="tg-icon"><UiIcon name="messageCircle" :size="28" /></span>
        <div>
          <UiText size="small" class="tg-title">Telegram бот</UiText>
          <UiText size="tiny" class="tg-desc">Функция будет доступна в следующем обновлении</UiText>
        </div>
        <UiTag size="small" class="tg-badge">Скоро</UiTag>
      </div>

      <div class="footer">
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </div>
  </UiForm>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { UiForm, UiInput, UiButton, UiLink, UiText, UiIcon, UiTag, useMessage } from '@fastio/ui'
import type { Tenant } from '@fastio/shared'

const props = defineProps<{ tenant: Tenant }>()
const emit = defineEmits<{ save: [data: Partial<Tenant>] }>()

const form = reactive({
  email: props.tenant.notifications?.email ?? '',
  telegramChatId: props.tenant.notifications?.telegramChatId ?? '',
})

watch(() => props.tenant.notifications, (n) => {
  form.email = n?.email ?? ''
  form.telegramChatId = n?.telegramChatId ?? ''
})

const saving = ref(false)
const { success } = useMessage()

const handleSave = async () => {
  saving.value = true
  try {
    await emit('save', {
      notifications: {
        email: form.email || null,
        telegramChatId: form.telegramChatId || null,
      },
    })
    success('Сохранено')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/form' as *;

.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-title {
  @include section-title;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.tg-status {
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

.tg-badge {
  margin-left: auto;
}

.footer {
  @include settings-footer;
}

</style>
