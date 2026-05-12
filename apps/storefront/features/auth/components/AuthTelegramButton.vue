<template>
  <div class="tg-btn-root">
    <button v-if="!polling" type="button" class="tg-btn" :disabled="initializing" @click="start">
      <SfIconTelegram v-if="!initializing" :size="22" class="tg-icon" />
      <FsSpinner v-else size="small" class="tg-spinner" />
      Войти через Telegram
    </button>

    <div v-else class="waiting">
      <FsSpinner size="small" />
      <span class="hint">Откройте Telegram и нажмите Start</span>
      <button type="button" class="cancel" @click="cancel">Отмена</button>
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

const initializing = ref(false)
const polling = ref(false)
const error = ref('')
let intervalId: ReturnType<typeof setInterval> | null = null

async function start() {
  if (polling.value || initializing.value) return
  initializing.value = true
  error.value = ''
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

function startPolling(nonce: string) {
  // На всякий случай — не плодим параллельные интервалы.
  stopPolling()
  intervalId = setInterval(async () => {
    try {
      const { status } = await $fetch<{ status: 'pending' | 'ok' | 'expired' }>(
        `/api/auth/telegram/poll?nonce=${nonce}`,
      )

      if (status === 'ok') {
        stopPolling()
        emit('done')
      } else if (status === 'expired') {
        stopPolling()
        polling.value = false
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
</style>
