<template>
  <UiPopover
    trigger="hover"
    no-sheet
    :width="260"
    :delay="500"
  >
    <template #trigger>
      <UiIcon name="help" class="hint-icon" />
    </template>
    <slot />
  </UiPopover>
</template>

<script setup lang="ts">
import { UiPopover, UiIcon } from '@fastio/ui'
</script>

<style scoped lang="scss">
.hint-icon {
  color: var(--color-text-tertiary);
  cursor: default;
  font-size: 14px;
  flex-shrink: 0;
}
</style>
