import { ref } from 'vue'
import { useRoute } from '#imports'
import { useTenantStore } from '~/stores/tenant'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function useAiChat() {
  const route = useRoute()
  const tenantStore = useTenantStore()

  const messages = ref<Message[]>([])
  const input = ref('')
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  let abortController: AbortController | null = null

  async function handleSubmit() {
    const text = input.value.trim()

    if (!text || isLoading.value) return

    error.value = null
    input.value = ''

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }

    messages.value.push(userMessage)

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    }

    messages.value.push(assistantMessage)

    isLoading.value = true
    abortController = new AbortController()

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.value
            .filter((m) => m.content)
            .map((m) => ({ role: m.role, content: m.content })),
          context: {
            tenantName: tenantStore.tenant?.name,
            businessType: tenantStore.tenant?.businessType,
            currentRoute: route.path,
          },
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()

      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })

        assistantMessage.content += chunk
        messages.value = [...messages.value]
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        error.value = err as Error
        // Remove empty assistant message on error
        if (!assistantMessage.content) {
          messages.value = messages.value.filter((m) => m.id !== assistantMessage.id)
        }
      }
    } finally {
      isLoading.value = false
      abortController = null
    }
  }

  function stop() {
    abortController?.abort()
  }

  async function reload() {
    // Remove last assistant message and resend
    const lastUserIdx = messages.value.findLastIndex((m) => m.role === 'user')

    if (lastUserIdx === -1) return

    const lastUserMessage = messages.value[lastUserIdx]

    messages.value = messages.value.slice(0, lastUserIdx)
    input.value = lastUserMessage.content
    await handleSubmit()
  }

  return {
    messages,
    input,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
  }
}
