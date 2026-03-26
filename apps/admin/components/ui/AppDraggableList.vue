<template>
  <VueDraggable
    :model-value="modelValue"
    class="list"
    handle=".drag-handle"
    :animation="180"
    ghost-class="item-ghost"
    @update:model-value="$emit('update:modelValue', $event)"
    @end="$emit('reorder')"
  >
    <slot />
  </VueDraggable>
</template>

<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'

defineProps<{ modelValue: unknown[] }>()
defineEmits<{
  'update:modelValue': [value: unknown[]]
  'reorder': []
}>()
</script>

<style scoped lang="scss">
.list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:deep(.item-ghost) {
  opacity: 0.4;
}
</style>
