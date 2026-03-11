<template>
  <form class="ui-form" @submit.prevent="handleSubmit">
    <transition name="form-error">
      <div v-if="error" class="form-error">{{ error }}</div>
    </transition>
    <slot />
  </form>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import type { FormContext, FormValues } from '@fastio/kit'
import type { ResponsiveSizeMap } from '@fastio/kit'
import { FORM_SIZE_KEY } from '@fastio/kit'

type Props = {
  form?: FormValues
  error?: string
  responsive?: ResponsiveSizeMap
}

type Emits = {
  submit: [values: FormValues]
}

const props = defineProps<Props>()

const emit = defineEmits<Emits>()

const fieldValidators = new Map<string, () => boolean>()

const registerField = (name: string, validateFn: () => boolean) => {
  fieldValidators.set(name, validateFn)
}

const unregisterField = (name: string) => {
  fieldValidators.delete(name)
}

const validateForm = (): boolean => {
  let isValid = true

  fieldValidators.forEach((validateFn) => {
    const fieldValid = validateFn()

    if (!fieldValid) {
      isValid = false
    }
  })

  return isValid
}

const handleSubmit = () => {
  if (validateForm()) {
    emit('submit', props.form || {})
  }
}

const formContext: FormContext = {
  registerField,
  unregisterField,
}

provide('formContext', formContext)

if (props.responsive) {
  provide(FORM_SIZE_KEY, computed(() => props.responsive!))
}

defineExpose({
  validate: validateForm,
  reset: () => {
    if (props.form) {
      Object.keys(props.form).forEach((key) => {
        props.form![key] = ''
      })
    }
  },
  values: props.form,
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.ui-form {
  display: flex;
  flex-direction: column;
  gap: 8px;

  @include mq-l {
    gap: 12px;
  }
}

.form-error {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--color-error-light);
  color: var(--color-error);
  font-size: 14px;
}

.form-error-enter-active,
.form-error-leave-active {
  overflow: hidden;
  transition:
    max-height 0.3s ease,
    opacity 0.3s ease;
}

.form-error-enter-from,
.form-error-leave-to {
  max-height: 0;
  opacity: 0;
}

.form-error-enter-to,
.form-error-leave-from {
  max-height: 200px;
  opacity: 1;
}
</style>
