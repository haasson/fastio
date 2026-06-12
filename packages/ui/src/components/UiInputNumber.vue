<template>
  <form-item
    :label="label"
    :size="computedSize"
    :name="name"
    :rules="rules"
    :message="message"
    :model-value="modelValue"
    :status="status"
    :feedback="feedback"
    :help="help"
    v-slot="{ hasError }"
  >
    <n-input-number
      v-model:value="modelValue"
      :size="computedSize"
      class="input"
      :min="min"
      :max="max"
      :step="step"
      :precision="precision"
      :placeholder="placeholder"
      :clearable="clearable"
      :show-button="showButton"
      :status="hasError ? 'error' : (status || undefined)"
      :keyboard="{ ArrowUp: false, ArrowDown: false }"
      v-bind="$attrs"
      @keydown="filterKey"
    >
      <template v-if="$slots.prefix" #prefix>
        <slot name="prefix" />
      </template>
      <template v-if="$slots.suffix" #suffix>
        <slot name="suffix" />
      </template>
      <!-- @vue-ignore naive-ui types don't expose clear-icon slot for NInputNumber, but it works at runtime -->
      <template #clear-icon>
        <ui-icon name="crossRound" :size="iconSize" color="grey-400" />
      </template>
    </n-input-number>
  </form-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NInputNumber } from 'naive-ui'
import { UiIcon } from '@fastio/icons'
import FormItem from './internal/FormItem.vue'
import { useResponsiveSize } from '@fastio/kit'
import type { Size, ResponsiveSizeMap } from '@fastio/kit'
import type { ValidationRule } from '@fastio/kit'

type Props = {
  label?: string
  min?: number
  max?: number
  step?: number
  precision?: number
  placeholder?: string
  clearable?: boolean
  showButton?: boolean
  size?: Size
  responsive?: ResponsiveSizeMap
  name?: string
  rules?: ValidationRule[]
  message?: string
  status?: 'success' | 'warning' | 'error'
  feedback?: string
  help?: string
}

const props = withDefaults(defineProps<Props>(), {
  clearable: true,
  showButton: false,
  size: 'medium',
})

const modelValue = defineModel<number | null>({ default: null })

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

const iconSize = computed(() => {
  switch (computedSize.value) {
    case 'tiny': return 12
    case 'small': return 14
    case 'medium': return 16
    case 'large': return 24
    default: return 16
  }
})

function filterKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const allowed = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (allowed.includes(e.key)) return
  if (/^\d$/.test(e.key)) return
  if (e.key === '.' || e.key === ',') return
  // Минус разрешён только если инпут вообще допускает отрицательные значения.
  // При min >= 0 (цены, вес, количество) '-' блокируется на вводе.
  if (e.key === '-' && (props.min === undefined || props.min < 0)) return
  e.preventDefault()
}

defineOptions({
  inheritAttrs: false,
})
</script>

