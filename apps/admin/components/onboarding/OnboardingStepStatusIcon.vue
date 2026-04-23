<template>
  <span class="icon-root" :class="`status-${status}`">
    <UiIcon v-if="status === 'done'" name="check" :size="10" />
    <span v-else-if="label !== undefined" class="num">{{ label }}</span>
    <span v-else class="dot" />
  </span>
</template>

<script setup lang="ts">
import { UiIcon } from '@fastio/ui'

type Status = 'done' | 'active' | 'locked'

defineProps<{
  status: Status
  /** Цифра/текст в центре, когда статус не done. Если не задано — точка. */
  label?: string | number
}>()
</script>

<style scoped lang="scss">
.icon-root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
}

.status-done {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-white);
}

.status-active {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.num {
  font-size: 10px;
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-text-hint);
}
</style>
