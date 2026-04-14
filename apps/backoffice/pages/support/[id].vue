<template>
  <div class="page-root">
    <header class="header">
      <div class="header-left">
        <NButton text @click="router.push('/support')">
          ← Назад
        </NButton>
        <h2 class="subject">{{ ticket?.subject ?? '...' }}</h2>
        <NTag
          v-if="ticket"
          :type="statusMap[ticket.status]?.type ?? 'default'"
          size="small"
          :bordered="false"
        >
          {{ statusMap[ticket.status]?.label ?? ticket.status }}
        </NTag>
      </div>
      <div class="header-right">
        <span v-if="ticket" class="tenant-name">{{ ticket.tenantName }}</span>
        <NButton
          v-if="ticket && ticket.status !== 'resolved'"
          type="error"
          size="small"
          :loading="closing"
          @click="closeTicket"
        >
          Закрыть обращение
        </NButton>
      </div>
    </header>

    <div class="messages-container">
      <div ref="messagesListRef" class="messages-list">
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message"
          :class="msg.senderType === 'support' ? 'message-support' : 'message-tenant'"
        >
          <div class="bubble">
            <div class="bubble-body">{{ msg.body }}</div>
            <div v-if="msg.imageUrls?.length" class="bubble-images">
              <a
                v-for="(url, i) in msg.imageUrls"
                :key="i"
                :href="url"
                target="_blank"
                class="bubble-image-link"
              >
                <img :src="url" alt="" />
              </a>
            </div>
            <div class="bubble-time">
              {{ new Date(msg.createdAt).toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              }) }}
            </div>
          </div>
        </div>

        <div v-if="!messages.length && !messagesLoading" class="empty">
          Сообщений пока нет
        </div>
      </div>

      <div v-if="ticket && ticket.status !== 'resolved'" class="input-area">
        <NInput
          v-model:value="newMessage"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          placeholder="Написать ответ..."
          @keydown.enter.exact.prevent="sendMessage"
        />
        <NButton
          type="primary"
          :loading="sending"
          :disabled="!newMessage.trim()"
          @click="sendMessage"
        >
          Отправить
        </NButton>
      </div>

      <div v-if="ticket && ticket.status === 'resolved'" class="closed-notice">
        Обращение закрыто
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFetch, useRoute, useRouter } from '#imports'
import { $fetch } from 'ofetch'
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { NButton, NTag, NInput, useMessage } from 'naive-ui'

const route = useRoute()
const router = useRouter()
const ticketId = computed(() => route.params.id as string)
const toast = useMessage()

type Ticket = {
  id: string
  tenantId: string
  tenantName: string
  subject: string
  status: string
  createdAt: string
  updatedAt: string
}

type Message = {
  id: string
  ticketId: string
  senderType: string
  senderId: string
  body: string
  imageUrls: string[]
  createdAt: string
}

const statusMap: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
  open: { label: 'Открыт', type: 'warning' },
  waiting_for_reply: { label: 'Ожидает ответа', type: 'info' },
  resolved: { label: 'Закрыт', type: 'success' },
}

const { data: ticketData, refresh: refreshTicket } = await useFetch<Ticket>(
  computed(() => `/api/support/${ticketId.value}`),
)

const ticket = computed(() => ticketData.value)

const { data: messagesData, pending: messagesLoading, refresh: refreshMessages } = await useFetch<Message[]>(
  computed(() => `/api/support/${ticketId.value}/messages`),
)

const messages = computed(() => messagesData.value ?? [])

const newMessage = ref('')
const sending = ref(false)
const closing = ref(false)
const messagesListRef = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (messagesListRef.value) {
      messagesListRef.value.scrollTop = messagesListRef.value.scrollHeight
    }
  })
}

watch(messages, () => scrollToBottom(), { deep: true })

async function markSeen() {
  try {
    await $fetch(`/api/support/${ticketId.value}/seen`, { method: 'POST' })
  } catch {
    // silent
  }
}

async function sendMessage() {
  const text = newMessage.value.trim()

  if (!text || sending.value) return

  sending.value = true
  try {
    await $fetch(`/api/support/${ticketId.value}/messages`, {
      method: 'POST',
      body: { body: text },
    })
    newMessage.value = ''
    await refreshMessages()
    await refreshTicket()
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка отправки'

    toast.error(msg)
  } finally {
    sending.value = false
  }
}

async function closeTicket() {
  closing.value = true
  try {
    await $fetch(`/api/support/${ticketId.value}/close`, { method: 'POST' })
    await refreshTicket()
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string } })?.data?.message ?? 'Ошибка'

    toast.error(msg)
  } finally {
    closing.value = false
  }
}

let es: globalThis.EventSource | null = null

onMounted(async () => {
  await markSeen()
  scrollToBottom()

  // eslint-disable-next-line no-undef
  es = new EventSource(`/api/support/stream?ticketId=${ticketId.value}`)

  es.addEventListener('message', async () => {
    await refreshMessages()
    await markSeen()
  })

  es.addEventListener('ticket', async () => {
    await refreshTicket()
  })
})

onUnmounted(() => {
  es?.close()
})
</script>

<style scoped lang="scss">
.page-root {
  padding: 32px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 73px);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.subject {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.tenant-name {
  font-size: 14px;
  color: #888;
}

.messages-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  min-height: 0;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message {
  display: flex;
}

.message-tenant {
  justify-content: flex-start;
}

.message-support {
  justify-content: flex-end;
}

.bubble {
  max-width: 65%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.4;
}

.message-tenant .bubble {
  background: #f0f0f0;
  border-bottom-left-radius: 4px;
}

.message-support .bubble {
  background: #e8f4fd;
  border-bottom-right-radius: 4px;
}

.bubble-body {
  white-space: pre-wrap;
  word-break: break-word;
}

.bubble-images {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.bubble-image-link {
  width: 120px;
  height: 90px;
  border-radius: 8px;
  overflow: hidden;
  display: block;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.bubble-time {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  text-align: right;
}

.empty {
  text-align: center;
  color: #999;
  padding: 40px 0;
}

.input-area {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #eee;
  align-items: flex-end;
}

.closed-notice {
  text-align: center;
  padding: 12px;
  color: #999;
  border-top: 1px solid #eee;
  font-size: 14px;
}
</style>
