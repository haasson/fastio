<template>
  <div class="ticket-chat-root">
    <div class="header">
      <div class="header-info">
        <UiText size="small" weight="medium">{{ ticket?.subject }}</UiText>
        <UiTag
          v-if="ticket"
          :type="statusMap[ticket.status].type"
          size="tiny"
          round
        >
          {{ statusMap[ticket.status].label }}
        </UiTag>
      </div>
      <UiButton
        v-if="ticket && ticket.status !== 'resolved'"
        size="small"
        type="default"
        @click="handleClose"
      >Закрыть обращение</UiButton>
    </div>

    <div ref="messagesRef" class="messages">
      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        :is-mine="msg.senderType === 'tenant'"
      />
    </div>

    <ChatInput
      v-if="ticket && ticket.status !== 'resolved'"
      @send="handleSend"
      @upload="handleUpload"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiText, UiTag, useMessage } from '@fastio/ui'
import type { SupportTicket, SupportMessage } from '@fastio/shared'
import { supportStatusMap as statusMap } from '~/utils/supportStatus'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { supportEvents } from '~/composables/data/useSupportChannel'
import { reportError } from '~/utils/reportError'
import MessageBubble from '~/components/support/MessageBubble.vue'
import ChatInput from '~/components/support/ChatInput.vue'

const props = defineProps<{
  ticketId: string
}>()

const emit = defineEmits<{
  closed: []
}>()

const api = useDatabase()
const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)
const { success, error: showError } = useMessage()

const ticket = ref<SupportTicket | null>(null)
const messages = ref<SupportMessage[]>([])
const messagesRef = ref<HTMLElement | null>(null)

const scrollToBottom = async () => {
  await nextTick()
  const el = messagesRef.value

  if (el) el.scrollTop = el.scrollHeight
}

const loadData = async () => {
  try {
    const [t, msgs] = await Promise.all([
      api.support.getTicket(props.ticketId),
      api.support.listMessages(props.ticketId),
    ])

    ticket.value = t
    messages.value = msgs
    await scrollToBottom()
  } catch (err) {
    reportError(err)
  }
}

const handleSend = async (body: string, imageUrls: string[]) => {
  try {
    await api.support.sendMessage(
      props.ticketId,
      body,
      imageUrls.length ? imageUrls : undefined,
    )

    await loadData()
  } catch (err) {
    reportError(err)
    showError('Не удалось отправить сообщение')
  }
}

const handleUpload = async (file: File, callback: (url: string | null) => void) => {
  try {
    const url = await api.support.uploadImage(currentTenantId.value!, props.ticketId, file)

    callback(url)
  } catch (err) {
    reportError(err)
    showError('Не удалось загрузить изображение')
    callback(null)
  }
}

const handleClose = async () => {
  try {
    await api.support.closeTicket(props.ticketId)

    ticket.value = { ...ticket.value!, status: 'resolved' }
    success('Обращение закрыто')
    emit('closed')
  } catch (err) {
    reportError(err)
    showError('Не удалось закрыть обращение')
  }
}

const unsubTicketUpdate = supportEvents.onTicketUpdate((t) => {
  if (t.id === props.ticketId) loadData()
})

watch(() => props.ticketId, async (id) => {
  await loadData()
  await api.support.markSeen(id)
}, { immediate: true })

onUnmounted(() => {
  unsubTicketUpdate()
})
</script>

<style scoped lang="scss">
.ticket-chat-root {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
