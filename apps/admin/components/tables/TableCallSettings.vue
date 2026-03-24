<template>
  <div class="call-settings-root">
    <!-- ── Типы вызовов ─────────────────────────────────────── -->
    <UiCard>
      <UiTitle size="h4" class="section-title">Типы вызовов</UiTitle>

      <div v-if="callTypes.length" class="type-list">
        <div v-for="type in callTypes" :key="type.id" class="type-item">
          <UiText size="small" class="type-name">{{ type.name }}</UiText>
          <UiButton
            size="small"
            type="text"
            icon="trash"
            @click="$emit('remove-type', type.id)"
          />
        </div>
      </div>

      <UiDivider v-if="callTypes.length" />

      <div class="type-add">
        <UiInput
          v-model:value="newTypeName"
          placeholder="Название типа вызова"
          class="type-input"
          @keydown.enter="submitNewType"
        />
        <UiButton
          type="primary"
          icon="plus"
          :disabled="!newTypeName.trim()"
          @click="submitNewType"
        >
          Добавить
        </UiButton>
      </div>
    </UiCard>

    <!-- ── Активные вызовы ─────────────────────────────────── -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiCard, UiButton, UiInput, UiText, UiTitle, UiEmpty, UiIcon, UiDivider } from '@fastio/ui'
import type { TableCallType, TableCall, Table } from '@fastio/shared'
import { formatRelativeTime } from '@fastio/shared'

const props = defineProps<{
  callTypes: TableCallType[]
  activeCalls: TableCall[]
  tables: Table[]
}>()

const emit = defineEmits<{
  'add-type': [name: string]
  'remove-type': [id: string]
  'resolve': [id: string]
}>()

const now = useNow({ interval: 30_000 })
const newTypeName = ref('')

const tableNameById = computed(() => {
  const map: Record<string, string> = {}

  for (const table of props.tables) {
    map[table.id] = table.name
  }

  return map
})

const submitNewType = () => {
  const name = newTypeName.value.trim()

  if (!name) return
  emit('add-type', name)
  newTypeName.value = ''
}
</script>

<style scoped lang="scss">
.call-settings-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-title {
  margin-bottom: 12px;
}

.type-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.type-name {
  flex: 1;
}

.type-add {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.type-input {
  flex: 1;
}

.call-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.call-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--color-bg-subtle);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.call-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.call-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.call-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.call-table {
  font-weight: 600;
}

.call-type {
  color: var(--color-text-hint);
}

.call-time {
  color: var(--color-text-hint);
}
</style>
