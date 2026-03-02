<template>
  <form @submit.prevent="handleSave">
    <div class="form">
      <p class="section-title">Уведомления о заказах</p>

      <div class="field">
        <UiInput
          v-model="form.email"
          label="Email для уведомлений"
          type="email"
          placeholder="orders@vasya-pizza.ru"
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
          <UiLink size="small" href="https://t.me/userinfobot" target="_blank" rel="noopener">@userinfobot</UiLink>
          (для личных сообщений) или добавьте бота в группу и используйте ID группы
        </span>
      </div>

      <div class="tg-status">
        <span class="tg-icon">🤖</span>
        <div>
          <p class="tg-title">Telegram бот</p>
          <p class="tg-desc">Функция будет доступна в следующем обновлении</p>
        </div>
        <span class="tg-badge">Скоро</span>
      </div>

      <div class="footer">
        <span v-if="saved" class="saved-msg">✅ Сохранено</span>
        <UiButton submit type="primary" :loading="saving">Сохранить</UiButton>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { UiInput, UiButton, UiLink } from '@fastfood-saas/ui'
import type { Tenant } from '@fastfood-saas/shared'

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
const saved = ref(false)

async function handleSave() {
  saving.value = true
  saved.value = false
  try {
    await emit('save', {
      notifications: {
        email: form.email || null,
        telegramChatId: form.telegramChatId || null,
      },
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aaa;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.hint {
  font-size: 12px;
  color: #aaa;
  line-height: 1.5;
}

.tg-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #f9f9f9;
  border-radius: 12px;
}

.tg-icon {
  font-size: 28px;
}

.tg-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.tg-desc {
  font-size: 12px;
  color: #aaa;
}

.tg-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  background: #f0f0f0;
  color: #888;
  padding: 3px 10px;
  border-radius: 20px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.saved-msg {
  font-size: 13px;
  color: #10b981;
}
</style>
