<template>
  <n-badge class="badge" :class="{ pulse, primary }">
    <slot v-if="$slots.default" />
  </n-badge>
</template>

<script setup lang="ts">
import { NBadge } from 'naive-ui'

type Props = {
  pulse?: boolean
  primary?: boolean
}

defineProps<Props>()
</script>

<style scoped lang="scss">
.badge {
  :deep(.n-badge-sup) {
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    border: 2px solid var(--color-white);
    border-radius: 12px;
    background-color: var(--yellow-400);
    font-family: var(--secondary-font);
    font-weight: 700;
    font-size: 14px;
    line-height: 20px;
    letter-spacing: -0.02em;
  }

  &.pulse {
    :deep(.n-badge-sup) {
      animation: pulse 1.5s infinite;
    }
  }

  &.primary {
    :deep(.n-badge-sup) {
      background-color: var(--color-primary);
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
