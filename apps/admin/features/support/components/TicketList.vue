<template>
  <div class="ticket-list-root">
    <div class="header">
      <UiButton type="primary" icon="plus" @click="$emit('create')">Создать обращение</UiButton>
    </div>

    <UiEmpty v-if="!tickets.length" icon="messageCircle" text="Нет обращений" />

    <div v-else class="list">
      <UiCard
        v-for="ticket in tickets"
        :key="ticket.id"
        size="small"
        clickable
        :class="{ active: ticket.id === activeId }"
        @click="$emit('select', ticket.id)"
      >
        <div class="row">
          <div class="main">
            <div class="top">
              <UiText size="small" weight="medium" class="subject">{{ ticket.subject }}</UiText>
              <UiTag :type="statusMap[ticket.status].type" size="tiny" round>
                {{ statusMap[ticket.status].label }}
              </UiTag>
            </div>
            <UiText
              v-if="ticket.lastMessage"
              size="tiny"
              color="secondary"
              class="preview"
            >
              {{ ticket.lastMessage }}
            </UiText>
          </div>
          <div class="meta">
            <UiText size="tiny" color="tertiary">{{ formatRelativeDate(ticket.lastMessageAt || ticket.createdAt) }}</UiText>
            <UiCounter
              v-if="ticket.unreadCount"
              :value="ticket.unreadCount"
              type="primary"
              size="tiny"
              filled
            />
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiButton, UiText, UiTag, UiCounter, UiEmpty, UiCard } from '@fastio/ui'
import type { SupportTicket } from '@fastio/shared'
import { supportStatusMap as statusMap } from '~/shared/utils/supportStatus'
import { formatRelativeDate } from '~/shared/utils/formatRelativeDate'

defineProps<{
  tickets: SupportTicket[]
  activeId?: string | null
}>()

defineEmits<{
  create: []
  select: [id: string]
}>()
</script>

<style scoped lang="scss">
.ticket-list-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.header {
  display: flex;
  justify-content: flex-end;
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.active {
  outline: 2px solid var(--color-primary);
}

.row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-12);
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.top {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.subject,
.preview {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-4);
}
</style>
