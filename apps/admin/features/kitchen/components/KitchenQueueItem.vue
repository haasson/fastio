<template>
  <UiCard size="small" class="queue-item-root" :class="[cancelled ? 'card--cancelled' : urgencyClass]">
    <div class="row">
      <span class="name" :class="{ 'name--cancelled': cancelled }">{{ item.dishName }}</span>
      <UiTag
        v-if="cancelled"
        size="small"
        type="error"
        round
      >Отменён</UiTag>
      <UiTag
        v-else
        size="small"
        :type="urgencyTagType"
        :empty="urgencyLevel === 'normal'"
        round
        :class="{ 'timer--critical': urgencyLevel === 'critical' }"
      >
        {{ elapsed }}
      </UiTag>
      <UiButton
        v-if="cancelled && canCook"
        size="small"
        type="error"
        ghost
        @click="$emit('dismiss')"
      >Убрать</UiButton>
      <UiButton
        v-else-if="!cancelled && canCook"
        size="small"
        type="primary"
        @click="$emit('claim')"
      >Взять</UiButton>
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
  cancelled?: boolean
  canCook?: boolean
}>()

defineEmits<{ claim: []; dismiss: [] }>()

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
  &.card--cancelled { border: 1.5px solid var(--color-error); opacity: 0.7; }
}

.name--cancelled {
  text-decoration: line-through;
  color: var(--color-text-secondary);
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
