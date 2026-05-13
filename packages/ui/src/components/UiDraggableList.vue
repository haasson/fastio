<template>
  <VueDraggable
    :model-value="modelValue"
    class="list"
    handle=".drag-handle"
    :animation="180"
    ghost-class="item-ghost"
    @update:model-value="$emit('update:modelValue', $event as T[])"
    @end="$emit('reorder')"
  >
    <slot />
  </VueDraggable>
</template>

<script setup lang="ts" generic="T">
import { VueDraggable } from 'vue-draggable-plus'

defineProps<{ modelValue: T[] }>()
defineEmits<{
  'update:modelValue': [value: T[]]
  'reorder': []
}>()
</script>

<style scoped lang="scss">
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

:deep(.item-ghost) {
  opacity: 0.4;
}
</style>
