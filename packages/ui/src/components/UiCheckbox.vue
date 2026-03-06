<template>
  <form-item
    :label="label"
    :size="size"
    :name="name"
    :rules="rules"
    :model-value="checked"
  >
    <n-checkbox
      v-model:checked="checked"
      :size="size"
      :class="{ 'checkbox--round': round }"
      v-bind="$attrs"
    >
      <slot />
    </n-checkbox>
  </form-item>
</template>

<script setup lang="ts">
import { NCheckbox } from 'naive-ui'
import FormItem from './internal/FormItem.vue'
import type { Size } from '../types/responsive'
import type { ValidationRule } from '../types/form'

type CheckboxSize = Exclude<Size, 'tiny'>

type Props = {
  label?: string
  round?: boolean
  size?: CheckboxSize
  name?: string
  rules?: ValidationRule[]
}

withDefaults(defineProps<Props>(), {
  size: 'medium',
})

const checked = defineModel<boolean>({ default: false })

defineOptions({
  inheritAttrs: false,
})
</script>

