<template>
  <div class="form-item" :class="formItemClasses">
    <div v-if="computedLabel || $slots['label-suffix']" class="label">
      <span v-if="computedLabel" v-html="computedLabel" />
      <slot name="label-suffix" />
    </div>
    <div class="control">
      <slot :has-error="hasError" />
    </div>
    <div v-if="computedError" class="error">{{ computedError }}</div>
    <div v-else-if="feedback && status" class="feedback" :class="`feedback--${status}`">{{ feedback }}</div>
    <div v-else-if="message" class="message">{{ message }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onBeforeUnmount, useAttrs, ref, watch } from 'vue'
import { validateValue } from '@fastio/kit'
import type { Size } from '@fastio/kit'
import type { FormContext, ValidationRule } from '@fastio/kit'

type Props = {
  label?: string
  size?: Size
  name?: string
  rules?: ValidationRule[]
  modelValue?: unknown
  status?: 'success' | 'warning' | 'error'
  feedback?: string
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  rules: () => [],
})

const attrs = useAttrs()

const error = ref<string | null>(null)
const touched = ref(false)

const formContext = inject<FormContext | null>('formContext', null)
const fieldName = computed(() => props.name || (attrs.name as string | undefined))

const validateField = (): boolean => {
  touched.value = true

  if (!props.rules || props.rules.length === 0) {
    error.value = null
    return true
  }

  const validationError = validateValue(props.modelValue, props.rules)
  error.value = validationError
  return !validationError
}

watch(() => props.modelValue, () => {
  if (touched.value) error.value = null
})

onMounted(() => {
  if (formContext && fieldName.value) {
    formContext.registerField(fieldName.value, validateField)
  }
})

onBeforeUnmount(() => {
  if (formContext && fieldName.value) {
    formContext.unregisterField(fieldName.value)
  }
})

const computedError = computed(() => touched.value ? error.value : null)
const hasError = computed(() => !!computedError.value)
const computedLabel = computed(() => props.label)
const formItemClasses = computed(() => [`form-item-${props.size}`])
</script>

<style scoped lang="scss">
@use 'sass:map';

$form-item-sizes: (
  'tiny': ('label-size': 12px, 'error-size': 12px, 'error-margin': 4px),
  'small': ('label-size': 12px, 'error-size': 12px, 'error-margin': 4px),
  'medium': ('label-size': 12px, 'error-size': 12px, 'error-margin': 4px),
  'large': ('label-size': 14px, 'error-size': 12px, 'error-margin': 4px),
);

.form-item {
  display: flex;
  flex-direction: column;

  .label {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    color: var(--color-text);
  }

  .control {
    display: block;
  }

  .error {
    color: var(--color-error);
  }

  .feedback {
    &--success { color: var(--color-success); }
    &--warning { color: var(--color-warning); }
    &--error { color: var(--color-error); }
  }

  .message {
    color: var(--color-text-secondary);
  }

  @each $size, $props in $form-item-sizes {
    &.form-item-#{$size} {
      .label { font-size: map.get($props, 'label-size'); }
      .error, .feedback, .message {
        margin-top: map.get($props, 'error-margin');
        font-size: map.get($props, 'error-size');
      }
    }
  }
}
</style>
