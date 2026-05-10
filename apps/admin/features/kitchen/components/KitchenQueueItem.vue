<template>
  <UiCard size="small" class="queue-item-root" :class="[urgencyClass]">
    <div class="row">
      <span class="name">{{ item.dishName }}</span>
      <UiTag
        size="small"
        :type="urgencyTagType"
        :empty="urgencyLevel === 'normal'"
        round
        :class="{ 'timer--critical': urgencyLevel === 'critical' }"
      >
        {{ elapsed }}
      </UiTag>
      <UiButton size="small" type="primary" @click="$emit('claim')">Взять</UiButton>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KitchenQueueItem } from '@fastio/shared'
import { UiCard, UiTag, UiButton } from '@fastio/ui'

const props = defineProps<{
  item: KitchenQueueItem
  elapsed: string
  urgencyLevel: 'normal' | 'warning' | 'critical'
}>()

defineEmits<{ claim: [] }>()

const urgencyClass = computed(() => {
  if (props.urgencyLevel === 'critical') return 'card--critical'
  if (props.urgencyLevel === 'warning') return 'card--warning'

  return ''
})

const urgencyTagType = computed(() => {
  if (props.urgencyLevel === 'critical') return 'error' as const
  if (props.urgencyLevel === 'warning') return 'warning' as const

  return 'default' as const
})
</script>

<style scoped lang="scss">
.queue-item-root {
  gap: 0;

  &.card--warning { border: 1.5px solid var(--color-warning); }
  &.card--critical { border: 1.5px solid var(--color-error); }
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timer--critical {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
