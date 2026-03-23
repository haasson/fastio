<template>
  <span
    class="order-status-root"
    :class="[`status-${group}`, `size-${size}`]"
  >
    <span class="status-dot" />
    <span class="status-label">{{ displayLabel }}</span>
  </span>
</template>
<script setup lang="ts">
import { computed } from 'vue'

type StatusGroup = 'new' | 'in_progress' | 'completed' | 'cancelled'

type Props = {
  group: StatusGroup
  label?: string
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const defaultLabels: Record<StatusGroup, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  completed: 'Выполнен',
  cancelled: 'Отменён',
}

const displayLabel = computed(() => props.label ?? defaultLabels[props.group])
</script>
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.order-status-root {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

// Sizes
.size-sm {
  @include text-micro;
  padding: 3px 8px;
}

.size-md {
  @include text-xs;
  padding: 4px 10px;
}

// Status colors
.status-new {
  background: color-mix(in srgb, #3b82f6 12%, transparent);
  color: #3b82f6;

  .status-dot {
    background: #3b82f6;
  }
}

.status-in_progress {
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  color: #f59e0b;

  .status-dot {
    background: #f59e0b;
  }
}

.status-completed {
  background: color-mix(in srgb, #10b981 12%, transparent);
  color: #10b981;

  .status-dot {
    background: #10b981;
  }
}

.status-cancelled {
  background: color-mix(in srgb, #6b7280 12%, transparent);
  color: #6b7280;

  .status-dot {
    background: #6b7280;
  }
}
</style>
