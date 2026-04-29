<template>
  <textarea
    class="textarea-root"
    :class="[`size-${size}`, { 'is-error': error }]"
    :style="{ resize: resize }"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :rows="rows"
    @input="onInput"
  />
</template>
<script setup lang="ts">
type Props = {
  modelValue?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  error?: boolean
  rows?: number
  resize?: 'none' | 'vertical' | 'both'
  size?: 'small' | 'medium'
}

withDefaults(defineProps<Props>(), {
  size: 'medium',
  rows: 3,
  resize: 'vertical',
  disabled: false,
  readonly: false,
  error: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>
<style scoped lang="scss">
.textarea-root {
  display: block;
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
  line-height: 1.5;

  &::placeholder {
    color: var(--color-text-muted);
  }

  &:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-subtle);
  }

  &.is-error {
    border-color: var(--color-error);

    &:focus {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error) 15%, transparent);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.size-small {
  font-size: 13px;
  padding-block: 8px;
  padding-inline: max(10px, min(var(--radius-btn), 20px));
}

.size-medium {
  font-size: 15px;
  padding-block: 10px;
  padding-inline: max(14px, min(var(--radius-btn), 28px));
}
</style>
