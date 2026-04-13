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
  gap: 12px;

  &.align-end {
    justify-content: space-between;

    .content { order: -1; }
  }
}

.content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 14px;
  color: var(--color-text);
  line-height: 1.4;
}

.hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}
</style>
