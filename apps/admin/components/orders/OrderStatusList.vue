<template>
  <div class="statuses-root">
    <UiTabs
      variant="pill"
      :model-value="modelValue ?? ''"
      :tabs="statusTabs"
      @update:model-value="$emit('update:modelValue', String($event))"
    />
    <span v-if="statusTabs.length" data-tour="order-statuses-ready" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiTabs } from '@fastio/ui'
import { useOrderStatusesStore } from '~/stores/retail/order-statuses'
import { STATUS_GROUP_TAG_TYPES } from '~/config/retail/order-status-groups'

const props = defineProps<{
  modelValue: string | null
  orderCounts: Record<string, number>
}>()

defineEmits<{
  'update:modelValue': [id: string | null]
}>()

const statusesStore = useOrderStatusesStore()
const { statuses } = storeToRefs(statusesStore)

const statusTabs = computed(() => statuses.value.map((s) => ({
  value: s.id,
  label: s.name,
  type: STATUS_GROUP_TAG_TYPES[s.groupType],
  count: props.orderCounts[s.id] ?? 0,
})))
</script>

<style scoped lang="scss">
.statuses-root {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}
</style>
