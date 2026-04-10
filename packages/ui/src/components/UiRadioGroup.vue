<template>
  <form-item
    :label="label"
    :size="size"
    :name="name"
    :rules="rules"
    :message="message"
    :model-value="selectedValue"
  >
    <n-radio-group
      v-model:value="selectedValue"
      class="radio-group"
      v-bind="$attrs"
    >
      <n-space :vertical="vertical" :size="space">
        <n-radio
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :size="size"
          :disabled="option.disabled"
          class="radio-option"
        >
          {{ option.label }}
        </n-radio>
      </n-space>
    </n-radio-group>
  </form-item>
</template>

<script setup lang="ts">
import { NRadioGroup, NRadio, NSpace } from 'naive-ui'
import FormItem from './internal/FormItem.vue'
import type { Size } from '@fastio/kit'
import type { ValidationRule } from '@fastio/kit'

type RadioSize = Exclude<Size, 'tiny'>

type RadioOption = {
  value: string | number
  label: string
  disabled?: boolean
}

type Props = {
  label?: string
  message?: string
  options: RadioOption[]
  vertical?: boolean
  space?: number
  size?: RadioSize
  name?: string
  rules?: ValidationRule[]
}

withDefaults(defineProps<Props>(), {
  space: 8,
  size: 'medium',
})

const selectedValue = defineModel<string | number | null>({ default: null })

defineOptions({
  inheritAttrs: false,
})
</script>

