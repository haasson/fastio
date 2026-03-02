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
      :class="['checkbox', { 'checkbox--round': round }]"
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

<style scoped lang="scss">
.checkbox {
  &:hover:not(.n-checkbox--disabled) {
    &:deep(.n-checkbox-box__border) {
      border-color: var(--color-primary) !important;
    }
    &.n-checkbox--checked {
      &:deep(.n-checkbox-box) {
        background-color: var(--color-primary) !important;
      }
    }
  }

  &:focus-visible {
    &:deep(.n-checkbox-box) {
      box-shadow: 0 0 0 2px var(--color-primary) !important;
    }
  }

  &:where(.checkbox--round) {
    &:deep(.n-checkbox-box) {
      border-radius: 50% !important;
    }

    &:deep(.n-checkbox-box__border) {
      border-radius: 50% !important;
    }

    &:deep(.n-checkbox-icon) {
      transform: scale(0.8);
    }
  }
}
</style>
