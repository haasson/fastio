<template>
  <form class="fs-form" novalidate @submit.prevent="handleSubmit">
    <slot />
  </form>
</template>

<script setup lang="ts">
import { provide } from 'vue'

type FormContext = {
  registerField: (key: string, validateFn: () => boolean) => void
  unregisterField: (key: string) => void
}

const emit = defineEmits<{
  submit: []
}>()

const fieldValidators = new Map<string, () => boolean>()

const registerField = (key: string, validateFn: () => boolean) => {
  fieldValidators.set(key, validateFn)
}

const unregisterField = (key: string) => {
  fieldValidators.delete(key)
}

const handleSubmit = () => {
  let valid = true
  fieldValidators.forEach((validateFn) => {
    if (!validateFn()) valid = false
  })
  if (valid) emit('submit')
}

provide<FormContext>('fs-form-context', { registerField, unregisterField })
</script>

<style scoped lang="scss">
.fs-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
