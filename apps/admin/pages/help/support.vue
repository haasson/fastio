<template>
  <div class="support-root">
    <div class="layout">
      <div class="sidebar">
        <TicketList
          :tickets="tickets"
          :active-id="selectedTicketId"
          @create="showCreateModal = true"
          @select="onSelectTicket"
        />
      </div>
      <div class="chat">
        <TicketChat
          v-if="selectedTicketId"
          :ticket-id="selectedTicketId"
          @closed="loadTickets"
        />
        <UiEmpty
          v-else
          icon="messageCircle"
          text="Выберите обращение или создайте новое"
        />
      </div>
    </div>

    <CreateTicketDrawer
      :show="showCreateModal"
      @close="showCreateModal = false"
      @created="onTicketCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { UiEmpty } from '@fastio/ui'
import type { SupportTicket } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { supportEvents } from '~/composables/data/useSupportChannel'
import { reportError } from '~/utils/reportError'
import TicketList from '~/components/support/TicketList.vue'
import TicketChat from '~/components/support/TicketChat.vue'
import CreateTicketDrawer from '~/components/support/CreateTicketDrawer.vue'

const api = useDatabase()
const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)

const tickets = ref<SupportTicket[]>([])
const selectedTicketId = ref<string | null>(null)
const showCreateModal = ref(false)

const sortByLastMessage = (list: SupportTicket[]) => [...list].sort((a, b) => {
  const ta = new Date(a.lastMessageAt ?? a.createdAt).getTime()
  const tb = new Date(b.lastMessageAt ?? b.createdAt).getTime()

  return tb - ta
})

const loadTickets = async () => {
  if (!currentTenantId.value) return

  try {
    const raw = await api.support.listTickets(currentTenantId.value)

    tickets.value = sortByLastMessage(raw)
  } catch (err) {
    reportError(err)
  }
}

const onSelectTicket = (id: string) => {
  selectedTicketId.value = id
}

const onTicketCreated = async (id: string) => {
  showCreateModal.value = false
  await loadTickets()
  selectedTicketId.value = id
}

const unsubTicketUpdate = supportEvents.onTicketUpdate((updated) => {
  const idx = tickets.value.findIndex((t) => t.id === updated.id)

  if (idx === -1) return

  const prev = tickets.value[idx]
  const prevDate = prev.lastMessageAt ?? prev.createdAt
  const newDate = updated.lastMessageAt ?? updated.createdAt

  tickets.value[idx] = updated

  if (newDate !== prevDate) {
    tickets.value = sortByLastMessage(tickets.value)
  }
})

onMounted(() => loadTickets())

onUnmounted(() => {
  unsubTicketUpdate()
})
</script>

<style scoped lang="scss">
.support-root {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.layout {
  display: flex;
  gap: 1px;
  background: var(--color-border);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  flex: 1;
  min-height: 400px;
}

.sidebar {
  width: 360px;
  flex-shrink: 0;
  overflow-y: auto;
  background: var(--color-bg-page);
  padding: 12px;
}

.chat {
  flex: 1;
  min-width: 0;
  background: var(--color-bg-card);
  display: flex;
  flex-direction: column;
}
</style>
