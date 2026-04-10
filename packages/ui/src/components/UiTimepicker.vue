<template>
  <form-item
    :label="label"
    :size="computedSize"
    :name="name"
    :rules="rules"
    :message="message"
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
      :input-readonly="true"
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
  message?: string
  size?: Size
  responsive?: ResponsiveSizeMap
  name?: string
  rules?: ValidationRule[]
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
})

const modelValue = defineModel<string | null>({ default: null })

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

const timestamp = computed<number | null>(() => {
  if (!modelValue.value) return null
  const [h, m] = modelValue.value.split(':').map(Number)
  return new Date(1970, 0, 1, h, m, 0, 0).getTime()
})

const onUpdate = (val: number | null) => {
  if (val === null) {
    modelValue.value = null
    return
  }
  const d = new Date(val)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  modelValue.value = `${h}:${m}`
}

defineOptions({ inheritAttrs: false })
</script>
