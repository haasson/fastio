<template>
  <form class="form" @submit.prevent="handleSave">
    <h3 class="section-title">Уведомления о заказах</h3>

    <div class="field">
      <label class="label">Email для уведомлений</label>
      <input
        v-model="form.email"
        class="input"
        type="email"
        placeholder="orders@vasya-pizza.ru"
      />
      <span class="hint">На этот адрес придёт письмо при каждом новом заказе</span>
    </div>

    <div class="field">
      <label class="label">Telegram Chat ID</label>
      <input
        v-model="form.telegramChatId"
        class="input"
        type="text"
        placeholder="-1001234567890"
      />
      <span class="hint">
        Как получить:
        <a class="link" href="https://t.me/userinfobot" target="_blank" rel="noopener">@userinfobot</a>
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
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? 'Сохранение…' : 'Сохранить' }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
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

<style scoped>
.form { display: flex; flex-direction: column; gap: 18px; }

.section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aaa;
}

.field { display: flex; flex-direction: column; gap: 5px; }
.label { font-size: 13px; font-weight: 600; color: #555; }
.hint { font-size: 12px; color: #aaa; line-height: 1.5; }

.link { color: #ff6b35; text-decoration: none; }
.link:hover { text-decoration: underline; }

.input {
  height: 42px;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus { border-color: #ff6b35; }

/* Telegram статус */
.tg-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #f9f9f9;
  border-radius: 12px;
}

.tg-icon { font-size: 28px; }

.tg-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.tg-desc { font-size: 12px; color: #aaa; }

.tg-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  background: #f0f0f0;
  color: #888;
  padding: 3px 10px;
  border-radius: 20px;
}

/* Footer */
.footer { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.saved-msg { font-size: 13px; color: #10b981; }

.btn-primary {
  height: 40px;
  padding: 0 20px;
  background: #ff6b35;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn-primary:hover:not(:disabled) { background: #e55a25; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
