<template>
  <n-modal
    :show="modelValue"
    preset="card"
    :title="title"
    :style="{ width, maxWidth: '90vw' }"
    :mask-closable="maskClosable"
    @update:show="emit('update:modelValue', $event)"
  >
    <slot />
  </n-modal>
</template>

<script setup lang="ts">
import { NModal } from 'naive-ui'

type Props = {
  modelValue: boolean
  title?: string
  width?: string
  maskClosable?: boolean
}

withDefaults(defineProps<Props>(), {
  width: '500px',
  maskClosable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
