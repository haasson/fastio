<template>
  <form-item
    :label="label"
    :size="size"
    :name="name"
    :rules="rules"
    :model-value="checked"
  >
    <n-switch
      v-model:value="checked"
      :size="nSize"
      v-bind="$attrs"
    >
      <template v-if="$slots.checked" #checked>
        <slot name="checked" />
      </template>
      <template v-if="$slots.unchecked" #unchecked>
        <slot name="unchecked" />
      </template>
    </n-switch>
  </form-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NSwitch } from 'naive-ui'
import FormItem from './internal/FormItem.vue'
import type { Size } from '../types/responsive'
import type { ValidationRule } from '../types/form'

type Props = {
  label?: string
  size?: Size
  name?: string
  rules?: ValidationRule[]
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
})

const checked = defineModel<boolean>({ default: false })

const nSize = computed(() => {
  const map: Record<Size, 'small' | 'medium' | 'large'> = {
    tiny: 'small',
    small: 'small',
    medium: 'medium',
    large: 'large',
  }
  return map[props.size]
})

defineOptions({
  inheritAttrs: false,
})
</script>
