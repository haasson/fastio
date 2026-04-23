<template>
  <!-- Number stepper -->
  <div
    v-if="type === 'number'"
    class="number-wrapper"
    :class="[`size-${size}`, { 'is-responsive': responsive, 'is-error': error, 'is-disabled': disabled }]"
  >
    <button class="number-btn" type="button" :disabled="disabled || isAtMin" @click="decrement">
      <Minus :size="iconSize" />
    </button>
    <input
      class="number-input"
      type="number"
      v-bind="$attrs"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :readonly="readonly"
      @input="onNumberInput"
    />
    <button class="number-btn" type="button" :disabled="disabled || isAtMax" @click="increment">
      <Plus :size="iconSize" />
    </button>
  </div>

  <!-- Input with prefix / suffix -->
  <div
    v-else-if="prefix || suffix || $slots.suffix"
    class="input-wrapper"
    :class="[`size-${size}`, { 'is-responsive': responsive, 'is-error': error, 'is-success': success }]"
  >
    <span v-if="prefix" class="prefix">{{ prefix }}</span>
    <input
      class="input-root"
      :class="[`size-${size}`, { 'is-responsive': responsive, 'has-prefix': prefix, 'has-suffix': suffix || $slots.suffix }]"
      v-bind="$attrs"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      @input="onInput"
    />
    <slot name="suffix" />
    <span v-if="suffix" class="suffix">{{ suffix }}</span>
  </div>

  <!-- Plain input -->
  <input
    v-else
    class="input-root"
    :class="[`size-${size}`, { 'is-responsive': responsive, 'is-error': error }]"
    v-bind="$attrs"
    v-maska="mask"
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    @input="onInput"
  />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Minus, Plus } from 'lucide-vue-next'
import { vMaska } from 'maska/vue'

type Props = {
  modelValue?: string | number
  type?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  error?: boolean
  size?: 'small' | 'medium' | 'large'
  responsive?: boolean
  prefix?: string
  suffix?: string
  success?: boolean
  min?: number
  max?: number
  step?: number
  mask?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  size: 'medium',
  responsive: false,
  disabled: false,
  readonly: false,
  error: false,
  step: 1,
})

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onNumberInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}

const numValue = computed(() => Number(props.modelValue ?? 0))
const isAtMin = computed(() => props.min !== undefined && numValue.value <= props.min)
const isAtMax = computed(() => props.max !== undefined && numValue.value >= props.max)

function decrement() {
  const next = numValue.value - props.step
  if (props.min === undefined || next >= props.min) {
    emit('update:modelValue', next)
  }
}

function increment() {
  const next = numValue.value + props.step
  if (props.max === undefined || next <= props.max) {
    emit('update:modelValue', next)
  }
}

const iconSize = computed(() => {
  if (props.size === 'small') return 14
  if (props.size === 'large') return 18
  return 16
})
</script>
<style scoped lang="scss">
.input-root {
  display: block;
  width: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
  height: var(--ctrl-h);
  padding: 0 var(--ctrl-px);
  font-size: var(--ctrl-fs);

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

  &.has-prefix {
    padding-left: 0;
  }

  &.has-suffix {
    padding-right: 0;
  }

  &.has-prefix,
  &.has-suffix {
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    flex: 1;
    min-width: 0;

    &:focus {
      box-shadow: none;
    }
  }
}

// Wrapper with prefix/suffix
.input-wrapper {
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
  height: var(--ctrl-h);
  font-size: var(--ctrl-fs);

  &:focus-within {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-subtle);
  }

  &.is-error {
    border-color: var(--color-error);

    &:focus-within {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error) 15%, transparent);
    }
  }

  &.is-success {
    border-color: var(--color-success);

    &:focus-within {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-success) 15%, transparent);
    }
  }
}

.prefix {
  padding: 0 0 0 var(--ctrl-px);
  color: var(--color-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
  font-size: inherit;
}

.suffix {
  padding: 0 var(--ctrl-px) 0 0;
  color: var(--color-text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
  font-size: inherit;
}

// Number stepper
.number-wrapper {
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
  height: var(--ctrl-h);
  font-size: var(--ctrl-fs);

  &:focus-within {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-subtle);
  }

  &.is-error {
    border-color: var(--color-error);

    &:focus-within {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-error) 15%, transparent);
    }
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.number-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--ctrl-h);
  height: 100%;
  color: var(--primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover:not(:disabled) {
    background: var(--primary-subtle);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.number-input {
  flex: 1;
  min-width: 0;
  text-align: center;
  background: transparent;
  border: none;
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  outline: none;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--ctrl-fs);
  font-weight: 600;
  height: 100%;
  padding: 0;

  // Hide native spinners
  -moz-appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }

  &:disabled {
    cursor: not-allowed;
  }
}
</style>
