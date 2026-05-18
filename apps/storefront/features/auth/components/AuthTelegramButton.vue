<template>
  <div class="tg-btn-root">
    <button v-if="!polling && !expired" type="button" class="tg-btn" :disabled="initializing" @click="start">
      <SfIconTelegram v-if="!initializing" :size="22" class="tg-icon" />
      <FsSpinner v-else size="small" class="tg-spinner" />
      Войти через Telegram
    </button>

    <div v-else-if="polling" class="waiting">
      <FsSpinner size="small" />
      <span class="hint">Откройте Telegram и нажмите Start</span>
      <button type="button" class="cancel" @click="cancel">Отмена</button>
    </div>

    <div v-else class="expired">
      <p class="expired-text">Время ожидания вышло. Попробуйте начать заново.</p>
      <button type="button" class="tg-btn" :disabled="initializing" @click="restart">
        <SfIconTelegram v-if="!initializing" :size="22" class="tg-icon" />
        <FsSpinner v-else size="small" class="tg-spinner" />
        Начать заново
      </button>
    </div>

    <p v-if="error" class="tg-error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { FsSpinner } from '@fastio/public-ui'
import SfIconTelegram from '~/shared/ui/sf/icons/SfIconTelegram.vue'
import { reportError } from '~/shared/utils/reportError'

const emit = defineEmits<{ done: [] }>()

// Должен совпадать с NONCE_TTL_MS в server/api/auth/telegram/init.post.ts (15 минут).
const POLL_MAX_DURATION_MS = 15 * 60 * 1000

const initializing = ref(false)
const polling = ref(false)
const expired = ref(false)
const error = ref('')
// Per-instance (не shared между юзерами): Vue компилирует <script setup> так что
// каждый mount получает свой замкнутый scope. SSR-безопасно — это client-only
// логика (window.open / setInterval), на сервере код этих веток не выполнится.
let intervalId: ReturnType<typeof setInterval> | null = null

async function start() {
  if (polling.value || initializing.value) return
  initializing.value = true
  error.value = ''
  expired.value = false
  try {
    const { nonce, botUsername } = await $fetch<{ nonce: string; botUsername: string }>(
      '/api/auth/telegram/init',
      { method: 'POST' },
    )

    window.open(`https://t.me/${botUsername}?start=${nonce}`, '_blank')
    polling.value = true
    startPolling(nonce)
  } catch (e) {
    reportError(e)
    error.value = 'Не удалось начать вход через Telegram. Попробуйте ещё раз.'
  } finally {
    initializing.value = false
  }
}

function restart() {
  expired.value = false
  start()
}

function startPolling(nonce: string) {
  // На всякий случай — не плодим параллельные интервалы.
  stopPolling()
  const startedAt = Date.now()
  intervalId = setInterval(async () => {
    // Локальный TTL-стоп: nonce на сервере живёт 15 минут, после этого
    // долбить /poll бесполезно — освобождаем worker'ов и показываем UX.
    if (Date.now() - startedAt > POLL_MAX_DURATION_MS) {
      stopPolling()
      polling.value = false
      expired.value = true
      return
    }
    try {
      const { status } = await $fetch<{ status: 'pending' | 'ok' | 'expired' }>(
        `/api/auth/telegram/poll?nonce=${nonce}`,
      )

      // Race-guard: пока шёл await (~200ms RTT), компонент мог unmount'нуться
      // (юзер закрыл модалку), отмениться через cancel(), сработать client-TTL
      // или родитель уже принял 'ok' от другого источника. stopPolling() в этих
      // путях занулил intervalId — обрабатывать ответ уже бессмысленно (и emit'нуть
      // 'done' можно на размонтированный родитель, или включить expired UI поверх
      // успешного логина).
      if (intervalId === null) return

      if (status === 'ok') {
        stopPolling()
        emit('done')
      } else if (status === 'expired') {
        stopPolling()
        polling.value = false
        expired.value = true
      }
    } catch (e) {
      // network hiccup — keep polling, но всё равно логируем
      reportError(e)
    }
  }, 2000)
}

function cancel() {
  stopPolling()
  polling.value = false
  expired.value = false
  error.value = ''
}

function stopPolling() {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}

onUnmounted(stopPolling)
</script>

<style scoped lang="scss">
.tg-btn-root {
  width: 100%;
}

.tg-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: #2aabee;
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;

  &:hover:not(:disabled) { background: #1d96d6; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.tg-icon {
  flex-shrink: 0;
}

.tg-spinner {
  flex-shrink: 0;
}

.waiting {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.hint {
  flex: 1;
}

.cancel {
  background: none;
  border: none;
  font: inherit;
  font-size: 13px;
  color: var(--primary);
  cursor: pointer;
  padding: 0;

  &:hover { text-decoration: underline; }
}

.tg-error {
  margin-top: 8px;
  font-size: 13px;
  color: var(--color-error);
  text-align: center;
}

.expired {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.expired-text {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  text-align: center;
}
</style>
