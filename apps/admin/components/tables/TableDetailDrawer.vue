<template>
  <UiDrawer
    :model-value="modelValue"
    :title="table?.name ?? 'Стол'"
    :width="480"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template v-if="table" #header-actions>
      <UiTag v-if="table.isOpen" type="success" size="small">Открыт {{ openedAgo }}</UiTag>
    </template>

    <div v-if="table" class="detail-root">
      <!-- Calls -->
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

      <TableSessionItems
        :session="session"
        :kitchen-dishes="kitchenDishes"
        :ready-dishes="readyDishes"
        @remove-dish="$emit('remove-dish', $event)"
        @repeat-item="$emit('repeat-item', $event)"
        @confirm-item="$emit('confirm-item', $event)"
        @reject-item="$emit('reject-item', $event)"
        @confirm-all="$emit('confirm-all')"
        @mark-served="$emit('mark-served', $event)"
      />
    </div>

    <template v-if="table?.isOpen" #footer>
      <UiButton type="primary" @click="$emit('add-dish')">+ Блюдо</UiButton>
      <UiButton type="default" @click="$emit('checkout')">Расчёт</UiButton>
    </template>
  </UiDrawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiDrawer, UiButton, UiIcon, UiTag } from '@fastio/ui'
import type { Table, TableCall, KitchenQueueItem } from '@fastio/shared'
import { formatRelativeTime } from '@fastio/shared'
import type { TableSession, TableSessionItem } from '~/utils/api/tables'
import TableSessionItems from '~/components/tables/TableSessionItems.vue'

type Props = {
  modelValue: boolean
  table: Table | null
  session?: TableSession
  calls: TableCall[]
  kitchenDishes?: KitchenQueueItem[]
  readyDishes?: KitchenQueueItem[]
}

const props = defineProps<Props>()

defineEmits<{
  'update:modelValue': [value: boolean]
  'add-dish': []
  'checkout': []
  'resolve-call': [id: string]
  'mark-served': [dishId: string]
  'remove-dish': [item: TableSessionItem]
  'repeat-item': [item: TableSessionItem]
  'confirm-item': [itemId: string]
  'reject-item': [itemId: string]
  'confirm-all': []
}>()

const now = useNow({ interval: 30_000 })

const openedAgo = computed(() => props.table?.openedAt ? formatRelativeTime(props.table.openedAt, now.value) : '')
</script>

<style scoped lang="scss">
.detail-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.calls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--color-warning-light);
  border-radius: 8px;
  border: 1px solid var(--color-warning);
}

.call-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.call-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.call-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-time {
  font-size: 12px;
  color: var(--color-text-hint);
  flex-shrink: 0;
}
</style>
