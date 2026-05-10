import { computed, ref } from 'vue'
import { useRoute } from '#imports'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { useTenantStore } from '~/shared/stores/tenant'
import { useAuthStore } from '~/shared/stores/auth'

export function useAiChat() {
  const route = useRoute()
  const tenantStore = useTenantStore()
  const authStore = useAuthStore()

  const input = ref('')

  const chat = new Chat({
    transport: new DefaultChatTransport({
      api: '/api/ai/chat',
      body: () => ({
        tenantId: tenantStore.currentTenantId,
        userId: authStore.user?.id,
        currentRoute: route.path,
      }),
    }),
  })

  const messages = computed(() => chat.messages)
  const status = computed(() => chat.status)
  const error = computed(() => chat.error)
  const isLoading = computed(() => chat.status === 'submitted' || chat.status === 'streaming')

  function handleSubmit() {
    const text = input.value.trim()

    if (!text || isLoading.value) return
    input.value = ''
    chat.sendMessage({ text })
  }

  function reload() {
    chat.regenerate()
  }

  function stop() {
    chat.stop()
  }

  function clearMessages() {
    chat.messages = []
  }

  return {
    messages,
    input,
    handleSubmit,
    isLoading,
    status,
    error,
    reload,
    stop,
    clearMessages,
  }
}
