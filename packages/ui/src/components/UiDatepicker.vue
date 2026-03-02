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
      :class="datepickerClasses"
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

const datepickerSize = computed(() => computedSize.value)

const datepickerClasses = computed(() => {
  return {
    datepicker: true,
    [`datepicker--${datepickerSize.value}`]: true,
  }
})

const calendarIconSize = computed(() => {
  switch (datepickerSize.value) {
    case 'tiny':
    case 'small':
      return 24
    default:
      return 32
  }
})

const chevronIconSize = computed(() => {
  return datepickerSize.value === 'large' ? 32 : 24
})

const currentYear = dayjs().year()

defineOptions({
  inheritAttrs: false,
})
</script>

<style scoped lang="scss">
@use 'sass:map';

$datepicker-sizes: (
  'tiny': ('border-radius': 8px),
  'small': ('border-radius': 12px),
  'medium': ('border-radius': 12px),
  'large': ('border-radius': 20px),
);

.form-item {
  @each $size, $config in $datepicker-sizes {
    &:has(.datepicker--#{$size}) {
      :deep(.n-input__border),
      :deep(.n-input__state-border) {
        border-radius: #{map.get($config, 'border-radius')} !important;
      }
    }
  }
}

.datepicker {
  &:deep(.n-base-clear) {
    * {
      width: 100%;
      height: 100%;
    }
  }

  &:deep(.n-input__border) {
    border-width: 2px !important;
    transition: opacity .3s ease;
  }

  &:deep(.n-input__state-border) {
    border-width: 2px !important;
  }

  &:deep(.n-input:not(.n-input--disabled):hover),
  &:deep(.n-input.n-input--focus),
  &:deep(.n-input.n-input--error-status),
  &:deep(.n-input.n-input--warning-status) {
    .n-input__border {
      opacity: 0;
    }
  }

  &:deep(.n-date-picker-icon) {
    color: var(--color-primary) !important;
  }

  &:where(.datepicker--tiny),
  &:where(.datepicker--small) {
    &:deep(.n-input__suffix) {
      --n-icon-size: 24px;
    }
  }

  &:where(.datepicker--medium),
  &:where(.datepicker--large) {
    &:deep(.n-input__suffix) {
      --n-icon-size: 32px;
    }
  }

  &:deep(.n-date-panel) {
    border-radius: 12px;
    border: 2px solid var(--color-primary);
  }

  &:deep(.n-date-panel-month__month-year) {
    --n-calendar-days-font-size: 14px;
    --n-item-font-size: 16px;
    --n-calendar-title-font-size: 14px;

    .n-date-panel-month__text {
      font-weight: 400;
    }
  }

  &:where(.datepicker--large) {
    &:deep(.n-date-panel-calendar) {
      --n-item-cell-width: 50px;
      --n-item-cell-height: 42px;
      --n-calendar-left-padding: 24px;
    }
    &:deep(.n-date-panel) {
      --n-date-panel-width: 360px;
    }
    &:deep(.n-date-panel-month__month-year) {
      --n-calendar-title-font-size: 16px;
    }
    &:deep(.n-date-panel-month__prev),
    &:deep(.n-date-panel-month__next) {
      --n-arrow-size: 32px;
    }
    &:deep(.n-date-panel-weekdays__day) {
      --n-calendar-days-font-size: 16px;
    }
    &:deep(.n-date-panel-date) {
      --n-item-font-size: 20px;
      --n-item-size: 40px;
    }
  }

  &:deep(.n-date-panel-date__date) {
    border-radius: 50px;

    &.n-date-panel-date__date--current {
      color: var(--grey-900);
      background-color: var(--blue-50);
    }

    &.n-date-panel-date__date--selected {
      color: var(--color-white);
      background-color: var(--color-primary);
    }

    &:hover:not(.n-date-panel-date__date--selected) {
      background-color: var(--blue-50);
    }

    &.n-date-panel-date__date--covered {
      background-color: var(--blue-50);
    }
  }

  &:deep(.n-date-panel-month__month-cell),
  &:deep(.n-date-panel-year__year-cell) {
    border-radius: 50px;

    &:hover {
      background-color: var(--blue-50);
    }

    &.n-date-panel-month__month-cell--selected,
    &.n-date-panel-year__year-cell--selected {
      color: var(--color-white);
      background-color: var(--color-primary);
    }

    &.n-date-panel-month__month-cell--current,
    &.n-date-panel-year__year-cell--current {
      color: var(--grey-900);
      background-color: var(--blue-50);
    }
  }

  &:deep(.n-date-panel-header__title) {
    &:hover {
      background-color: var(--blue-50);
    }
  }

  &:deep(.n-date-panel-month) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  &:deep(.n-date-panel-month__prev),
  &:deep(.n-date-panel-month__next) {
    flex-shrink: 0;
  }

  &:deep(.n-date-panel-month__fast-prev),
  &:deep(.n-date-panel-month__fast-next) {
    display: none;
  }
}
</style>
