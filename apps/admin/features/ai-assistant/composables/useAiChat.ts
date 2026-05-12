import { computed, ref } from 'vue'
import { useNuxtApp, useRoute } from '#imports'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { useTenantStore } from '~/shared/stores/tenant'

export function useAiChat() {
  const route = useRoute()
  const tenantStore = useTenantStore()
  const { $supabase } = useNuxtApp()

  const input = ref('')

  const chat = new Chat({
    transport: new DefaultChatTransport({
      api: '/api/ai/chat',
      headers: async (): Promise<Record<string, string>> => {
        const { data: { session } } = await ($supabase as SupabaseClient).auth.getSession()

        return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      },
      body: () => ({
        tenantId: tenantStore.currentTenantId,
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
