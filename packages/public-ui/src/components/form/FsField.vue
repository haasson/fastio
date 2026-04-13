<template>
  <div class="field-root">
    <FsLabel v-if="label" :required="required" :size="size" class="field-label">
      {{ label }}
    </FsLabel>
    <slot :has-error="!!computedError" />
    <p v-if="computedError" class="field-error">{{ computedError }}</p>
    <p v-else-if="hint" class="field-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, provide, onMounted, onBeforeUnmount } from 'vue'
import { validateValue } from '@fastio/kit'
import type { ValidationRule, FormContext } from '@fastio/kit'
import FsLabel from './FsLabel.vue'

type Props = {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  size?: 'sm' | 'md'
  name?: string
  modelValue?: unknown
  rules?: ValidationRule[]
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  required: false,
  rules: () => [],
})

const formContext = inject<FormContext | null>('fs-form-context', null)

provide('fs-field-label', computed(() => props.label ?? null))

const internalError = ref<string | null>(null)
const touched = ref(false)
const fieldKey = props.name ?? Math.random().toString(36).slice(2)

const validateField = (): boolean => {
  touched.value = true
  if (!props.rules || props.rules.length === 0) {
    internalError.value = null
    return true
  }
  const err = validateValue(props.modelValue, props.rules)
  internalError.value = err
  return !err
}

watch(() => props.modelValue, () => {
  if (touched.value) internalError.value = null
})

onMounted(() => {
  if (formContext && props.rules?.length) {
    formContext.registerField(fieldKey, validateField)
  }
})

onBeforeUnmount(() => {
  if (formContext) {
    formContext.unregisterField(fieldKey)
  }
})

const computedError = computed(() => internalError.value || props.error || null)
</script>

<style scoped lang="scss">
.field-root {
  display: flex;
  flex-direction: column;
}

.field-label {
  margin-bottom: 6px;
}

.field-error {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-error, #ef4444);
  line-height: 1.4;
}

.field-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.4;
}
</style>
