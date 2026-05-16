<template>
  <div ref="container" class="tg-widget-root" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRuntimeConfig } from '#imports'

type TelegramAuthData = Record<string, string>

const emit = defineEmits<{ auth: [data: TelegramAuthData] }>()

const container = ref<HTMLElement | null>(null)
const config = useRuntimeConfig()

// Each instance registers a uniquely named callback so multiple widgets on one page
// don't trample each other through window['onTelegramAuth'].
// `crypto.randomUUID()` is unavailable on http previews; the callback name is non-secret,
// so a Math.random fallback is fine here.
const callbackName = `onTelegramAuth_${makeCallbackId()}`

function makeCallbackId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

onMounted(() => {
  if (!container.value) return

  ;(window as unknown as Record<string, unknown>)[callbackName] = (user: TelegramAuthData) => {
    emit('auth', user)
  }

  const script = document.createElement('script')
  script.src = 'https://telegram.org/js/telegram-widget.js?22'
  script.async = true
  script.dataset.telegramLogin = config.public.telegramClientBotUsername
  script.dataset.size = 'large'
  script.dataset.onauth = `${callbackName}(user)`
  script.dataset.requestAccess = 'write'
  container.value.appendChild(script)
})

onUnmounted(() => {
  ;(window as unknown as Record<string, unknown>)[callbackName] = undefined
})
</script>

<style scoped lang="scss">
.tg-widget-root {
  display: flex;
  justify-content: center;
}
</style>
