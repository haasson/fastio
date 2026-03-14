<template>
  <form-item
    :label="label"
    :size="computedSize"
    :name="name"
    :rules="rules"
    :model-value="modelValue"
    v-slot="{ hasError }"
  >
    <n-time-picker
      :value="timestamp"
      :size="(computedSize as any)"
      class="timepicker"
      :status="hasError ? 'error' : undefined"
      format="HH:mm"
      :use-12-hours="false"
      :actions="null"
      :seconds="false"
      clearable
      v-bind="$attrs"
      @update:value="onUpdate"
    />
  </form-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NTimePicker } from 'naive-ui'
import FormItem from './internal/FormItem.vue'
import { useResponsiveSize } from '@fastio/kit'
import type { Size, ResponsiveSizeMap } from '@fastio/kit'
import type { ValidationRule } from '@fastio/kit'

type Props = {
  label?: string
  size?: Size
  responsive?: ResponsiveSizeMap
  name?: string
  rules?: ValidationRule[]
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
})

// v-model снаружи — строка "HH:MM" или null
const modelValue = defineModel<string | null>({ default: null })

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

// "HH:MM" → timestamp (NTimePicker работает с ms от начала суток)
const timestamp = computed<number | null>(() => {
  if (!modelValue.value) return null
  const [h, m] = modelValue.value.split(':').map(Number)
  return (h * 60 + m) * 60 * 1000
})

const onUpdate = (val: number | null) => {
  if (val === null) {
    modelValue.value = null
    return
  }
  const totalMin = Math.floor(val / 60000)
  const h = String(Math.floor(totalMin / 60)).padStart(2, '0')
  const m = String(totalMin % 60).padStart(2, '0')
  modelValue.value = `${h}:${m}`
}

defineOptions({ inheritAttrs: false })
</script>
