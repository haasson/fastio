<template>
  <div class="setting-toggle" :class="`align-${align}`">
    <UiSwitch :model-value="modelValue" :disabled="disabled" @update:model-value="$emit('update:modelValue', $event)" />
    <div class="content">
      <div class="label">{{ label }}</div>
      <div v-if="hint" class="hint">{{ hint }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiSwitch } from '@fastio/ui'

withDefaults(defineProps<{
  modelValue: boolean
  label: string
  hint?: string
  disabled?: boolean
  align?: 'start' | 'end'
}>(), {
  align: 'start',
})

defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<style scoped lang="scss">
.setting-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-12);

  &.align-end {
    justify-content: space-between;

    .content { order: -1; }
  }
}

.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.label {
  font-size: var(--font-size-md);
  color: var(--color-text);
  line-height: var(--line-height-base);
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-base);
}
</style>
