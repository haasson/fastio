<template>
  <div class="status-list-root">
    <UiSkeleton v-if="loading" :height="56" :count="3" />
    <UiEmpty v-else-if="statuses.length === 0" text="Нет статусов" />
    <AppDraggableList v-else v-model="localStatuses" @reorder="$emit('reorder', localStatuses)">
      <AppListRow v-for="status in localStatuses" :key="status.id">
        <template #name>
          <div class="name-row">
            <span class="group-dot" :style="{ backgroundColor: STATUS_GROUP_COLORS[status.groupType] }" />
            <UiText size="small" weight="medium">{{ status.name }}</UiText>
            <UiTag size="tiny" :type="STATUS_GROUP_TAG_TYPES[status.groupType]">
              {{ STATUS_GROUP_LABELS[status.groupType] }}
            </UiTag>
          </div>
        </template>
        <template v-if="status.quickActions.length > 0" #default>
          <UiText size="tiny" color="tertiary">
            Кнопки: {{ quickActionLabels(status) }}
          </UiText>
        </template>
        <template #append>
          <AppActionsBlock @edit="$emit('edit', status)" @delete="$emit('delete', status.id)" />
        </template>
      </AppListRow>
    </AppDraggableList>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiSkeleton, UiEmpty, UiText, UiTag } from '@fastio/ui'
import type { OrderStatus } from '@fastio/shared'
import { STATUS_GROUP_TAG_TYPES, STATUS_GROUP_LABELS, STATUS_GROUP_COLORS } from '~/config/order-status-groups'
import AppDraggableList from '~/components/ui/AppDraggableList.vue'
import AppListRow from '~/components/ui/AppListRow.vue'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'

const props = defineProps<{
  statuses: OrderStatus[]
  loading: boolean
}>()

defineEmits<{
  edit: [status: OrderStatus]
  delete: [id: string]
  reorder: [statuses: OrderStatus[]]
}>()

const localStatuses = ref<OrderStatus[]>([])

watch(() => props.statuses, (v) => {
  localStatuses.value = [...v]
}, { immediate: true, deep: true })

const quickActionLabels = (status: OrderStatus) => status.quickActions
  .map((id) => props.statuses.find((s) => s.id === id)?.name)
  .filter(Boolean)
  .join(', ')
</script>

<style scoped lang="scss">
.status-list-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.name-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.group-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
