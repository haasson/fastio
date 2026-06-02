<template>
  <UiCard>
    <UiTitle size="h4" class="section-title">Активные вызовы</UiTitle>

    <UiEmpty v-if="!activeCalls.length" icon="messageCircle" text="Нет активных вызовов" />

    <div v-else class="call-list">
      <div v-for="call in activeCalls" :key="call.id" class="call-item">
        <div class="call-info">
          <div class="call-header">
            <UiIcon name="messageCircle" :size="16" class="call-icon" />
            <UiText size="small" class="call-table">{{ tableNameById[call.tableId] ?? '—' }}</UiText>
            <UiText size="small" class="call-type">{{ call.callTypeName }}</UiText>
          </div>
          <UiText size="tiny" class="call-time">{{ formatRelativeTime(call.createdAt, now) }}</UiText>
        </div>
        <UiButton
          size="small"
          type="primary"
          icon="check"
          @click="$emit('resolve', call.id)"
        >
          Закрыть
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiCard, UiButton, UiText, UiTitle, UiEmpty, UiIcon } from '@fastio/ui'
import type { TableCall, Table } from '@fastio/shared'
import { formatRelativeTime } from '@fastio/shared'

const props = defineProps<{
  activeCalls: TableCall[]
  tables: Table[]
}>()

defineEmits<{
  resolve: [id: string]
}>()

const now = useNow({ interval: 30_000 })

const tableNameById = computed(() => {
  const map: Record<string, string> = {}

  for (const table of props.tables) {
    map[table.id] = table.name
  }

  return map
})
</script>

<style scoped lang="scss">
.section-title {
  margin-bottom: var(--space-12);
}

.call-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.call-item {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  padding: var(--space-8) var(--space-12);
  background: var(--color-bg-subtle);
  border-radius: var(--radius-8);
  border: 1px solid var(--color-border);
}

.call-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.call-header {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

.call-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.call-table {
  font-weight: var(--font-weight-semibold);
}

.call-type {
  color: var(--color-text-hint);
}

.call-time {
  color: var(--color-text-hint);
}
</style>
