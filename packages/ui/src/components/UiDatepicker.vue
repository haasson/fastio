<template>
  <form-item
    :label="label"
    :size="computedSize"
    :name="name"
    :rules="rules"
    :model-value="value"
    v-slot="{ hasError }"
  >
    <n-date-picker
      v-model:value="value"
      :size="(computedSize as any)"
      class="datepicker"
      :type="type || 'date'"
      :status="hasError ? 'error' : undefined"
      format="dd MMMM YYYY"
      month-format="LLLL"
      calendar-header-month-format="LLLL"
      :year-range="[2000, currentYear + 10]"
      :to="false"
      :actions="null"
      input-readonly
      clearable
      v-bind="$attrs"
    >
      <template #date-icon>
        <ui-icon name="calendar" :size="calendarIconSize" />
      </template>

      <template #prev-month>
        <ui-icon name="chevronRound" :rotate="90" :size="chevronIconSize" color="blue-500" />
      </template>
      <template #next-month>
        <ui-icon name="chevronRound" :rotate="270" :size="chevronIconSize" color="blue-500" />
      </template>
    </n-date-picker>
  </form-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NDatePicker } from 'naive-ui'
import dayjs from 'dayjs'
import UiIcon from './UiIcon.vue'
import FormItem from './internal/FormItem.vue'
import useResponsiveSize from '../composables/useResponsiveSize'
import type { DatePickerType } from 'naive-ui/es/date-picker/src/config'
import type { Size, ResponsiveSizeMap } from '../types/responsive'
import type { ValidationRule } from '../types/form'

type Props = {
  label?: string
  type?: DatePickerType
  size?: Size
  responsive?: ResponsiveSizeMap
  name?: string
  rules?: ValidationRule[]
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
})

const value = defineModel<number | null>({ default: null })

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

const calendarIconSize = computed(() => {
  switch (computedSize.value) {
    case 'tiny':
    case 'small':
      return 24
    default:
      return 32
  }
})

const chevronIconSize = computed(() => {
  return computedSize.value === 'large' ? 32 : 24
})

const currentYear = dayjs().year()

defineOptions({
  inheritAttrs: false,
})
</script>

