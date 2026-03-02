<template>
  <div class="form-item" :class="formItemClasses">
    <label v-if="computedLabel" v-html="computedLabel" class="label" />
    <div class="control">
      <slot :has-error="hasError" />
    </div>
    <div v-if="computedError" class="error">{{ computedError }}</div>
    <div v-else-if="feedback && status" class="feedback" :class="`feedback--${status}`">{{ feedback }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, onBeforeUnmount, useAttrs, ref, watch } from 'vue'
import { validateValue } from '../../utils/validators'
import type { Size } from '../../types/responsive'
import type { FormContext, ValidationRule } from '../../types/form'

type Props = {
  label?: string
  size?: Size
  name?: string
  rules?: ValidationRule[]
  modelValue?: unknown
  status?: 'success' | 'warning' | 'error'
  feedback?: string
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
    margin-bottom: 12px;
    color: var(--color-text);
  }

  .control {
    display: flex;
    flex-direction: column;
  }

  .error {
    color: var(--color-error);
  }

  .feedback {
    &--success { color: var(--color-success); }
    &--warning { color: var(--color-warning); }
    &--error { color: var(--color-error); }
  }

  @each $size, $props in $form-item-sizes {
    &.form-item-#{$size} {
      .label { font-size: map.get($props, 'label-size'); }
      .error, .feedback {
        margin-top: map.get($props, 'error-margin');
        font-size: map.get($props, 'error-size');
      }
    }
  }
}
</style>
