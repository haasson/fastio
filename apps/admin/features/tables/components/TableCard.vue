<template>
  <UiCard size="small" class="table-card" :class="{ 'table-card--open': table.isOpen, 'table-card--calling': calls.length > 0, 'table-card--ready': readyDishes?.length }">
    <div class="card-header">
      <div class="card-title">
        <UiIcon name="tableIcon" :size="18" class="card-icon" />
        <UiText size="medium" class="card-name">{{ table.name }}</UiText>
      </div>
      <UiTag v-if="pendingCount > 0" type="warning" size="small">{{ pendingCount }} ожидают</UiTag>
      <span v-if="table.capacity" class="card-cap"><UiIcon name="users" :size="12" /> {{ table.capacity }}</span>
      <UiMenuDropdown v-if="menuItems.length" :items="menuItems" @item-click="onMenuClick">
        <template #trigger>
          <UiButton
            type="text"
            size="small"
            icon="moreVertical"
            class="card-menu-trigger"
          />
        </template>
      </UiMenuDropdown>
    </div>

    <!-- Calls indicator -->
    <div v-if="calls.length" class="calls">
      <div v-for="call in calls" :key="call.id" class="call-item">
        <UiIcon name="messageCircle" :size="14" class="call-icon" />
        <span class="call-name">{{ call.callTypeName }}</span>
        <span class="call-time">{{ formatRelativeTime(call.createdAt, now) }}</span>
        <UiButton
          size="small"
          type="text"
          icon="check"
          @click="$emit('resolve-call', call.id)"
        />
      </div>
    </div>

    <!-- Open state -->
    <template v-if="table.isOpen">
      <UiText size="tiny" class="card-opened">Открыт {{ openedAgo }}</UiText>

      <TableSessionItems
        :session="session"
        :kitchen-dishes="kitchenDishes"
        :ready-dishes="readyDishes"
        compact
        :preview-count="PREVIEW"
        @remove-dish="$emit('remove-dish', $event)"
        @confirm-item="$emit('confirm-item', $event)"
        @reject-item="$emit('reject-item', $event)"
        @confirm-all="$emit('confirm-all')"
        @mark-served="$emit('mark-served', $event)"
      />

      <div class="card-btns">
        <UiButton size="small" type="primary" @click="$emit('add-dish')">+ Блюдо</UiButton>
        <UiButton size="small" type="default" @click="$emit('checkout')">Расчёт</UiButton>
      </div>
    </template>

    <!-- Closed state -->
    <template v-else>
      <UiButton
        size="small"
        full-width
        type="primary"
        @click="$emit('toggle-open')"
      >Открыть стол</UiButton>
    </template>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiCard, UiButton, UiIcon, UiText, UiTag, UiMenuDropdown } from '@fastio/ui'
import type { UiMenuDropdownItem } from '@fastio/ui'
import type { Table, TableCall, KitchenQueueItem } from '@fastio/shared'
import { formatRelativeTime } from '@fastio/shared'
import type { TableSession, TableSessionItem } from '../api/tables'
import TableSessionItems from './TableSessionItems.vue'
import { useGate } from '~/composables/plan/useGate'

const props = defineProps<{
  table: Table
  session?: TableSession
  calls: TableCall[]
  kitchenDishes?: KitchenQueueItem[]
  readyDishes?: KitchenQueueItem[]
}>()

const emit = defineEmits<{
  'add-dish': []
  'checkout': []
  'toggle-open': []
  'resolve-call': [id: string]
  'mark-served': [dishId: string]
  'remove-dish': [item: TableSessionItem]
  'confirm-item': [itemId: string]
  'reject-item': [itemId: string]
  'confirm-all': []
  'edit': []
  'show-qr': []
}>()

const gate = useGate()
const canManageTables = computed(() => gate.manageTables.value.enabled)

const menuItems = computed<UiMenuDropdownItem[]>(() => {
  if (!canManageTables.value) return []

  return [
    { name: 'edit', label: 'Настройки', icon: 'settings' },
    { name: 'qr', label: 'QR-код', icon: 'qrCode' },
  ]
})

const onMenuClick = (name: string) => {
  if (name === 'edit') emit('edit')
  else if (name === 'qr') emit('show-qr')
}

const PREVIEW = 3

const now = useNow({ interval: 30_000 })

const openedAgo = computed(() => props.table.openedAt ? formatRelativeTime(props.table.openedAt, now.value) : '')

const pendingCount = computed(() => (props.session?.items ?? []).filter((i) => i.status === 'pending').length)
</script>

<style scoped lang="scss">
.table-card {
  border: 1.5px solid var(--color-border);
  gap: var(--space-8);
  height: 100%;

  &--open {
    border-color: var(--color-success);
  }

  &--calling {
    border-color: var(--color-warning);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
  flex: 1;
}

.card-icon { color: var(--color-text-hint); flex-shrink: 0; }

.card-name {
  font-weight: var(--font-weight-semibold);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-menu-trigger {
  flex-shrink: 0;
  color: var(--color-text-hint);
}

.card-cap {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
  font-size: var(--font-size-xs);
  color: var(--color-text-hint);
  background: var(--color-bg-subtle);
  padding: var(--space-4) var(--space-8);
  border-radius: var(--radius-4);
  flex-shrink: 0;
}

.calls {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-8);
  background: var(--color-warning-light);
  border-radius: var(--radius-8);
  border: 1px solid var(--color-warning);
}

.call-item {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.call-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.call-name {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-hint);
  flex-shrink: 0;
}

.card-opened {
  color: var(--color-success);
  font-size: var(--font-size-xs);
}

.table-card--ready {
  border-color: var(--color-success);
  box-shadow: 0 0 0 1px var(--color-success);
}

.card-btns {
  display: flex;
  gap: var(--space-8);
  > * { flex: 1; }
}
</style>
