<template>
  <client-only :class="wrapperClass">
    <form-item
      :label="label"
      :size="computedSize"
      :name="name"
      :rules="rules"
      :model-value="selectedValues"
      v-slot="{ hasError }"
    >
      <n-select
        v-model:value="selectedValues"
        v-model:show="isOpen"
        :size="computedSize"
        :class="selectClasses"
        :show-checkmark="false"
        :to="false"
        :max-tag-count="1"
        :render-tag="renderTag"
        :render-label="renderLabel"
        :status="hasError ? 'error' : undefined"
        :options="filteredOptions"
        v-bind="selectAttrs"
        @click.stop="handleClick"
        @update:show="handleDropdownToggle"
      >
        <template #arrow>
          <slot name="arrow">
            <ui-icon
              name="chevronRound"
              :size="iconSize"
              :rotate="isOpen ? 180 : 0"
              bg="blue-100"
              fg="blue-500"
              class="select-arrow"
            />
          </slot>
        </template>
        <template v-if="isFilterable" #header>
          <ui-input
            ref="filterInputRef"
            v-model="filterQuery"
            placeholder="Поиск..."
            :size="computedSize"
            clearable
            class="filter-input"
            @click.stop
            @keydown.stop
          />
        </template>
        <template v-if="$slots.empty" #empty>
          <slot name="empty" />
        </template>
      </n-select>
    </form-item>
  </client-only>
</template>

<script setup lang="ts">
import { computed, h, ref, useAttrs } from 'vue'
import { NSelect, type SelectOption } from 'naive-ui'
import UiIcon from './UiIcon.vue'
import UiInput from './UiInput.vue'
import FormItem from './internal/FormItem.vue'
import useResponsiveSize from '../composables/useResponsiveSize'
import type { ResponsiveSizeMap, Size } from '../types/responsive'
import type { ValidationRule } from '../types/form'
import UiCheckbox from './UiCheckbox.vue'

export type UiSelectProps = {
  label?: string
  size?: Size
  responsive?: ResponsiveSizeMap
  accent?: boolean
  name?: string
  rules?: ValidationRule[]
  stateless?: boolean
  filterable?: boolean
}

const props = withDefaults(defineProps<UiSelectProps>(), {
  size: 'medium',
})

const attrs = useAttrs()

const wrapperClass = computed(() => attrs.class)
const selectAttrs = computed(() => {
  const { class: _, options: __, ...rest } = attrs

  return rest
})
const selectedValues = defineModel<string | number | Array<string | number> | null>('value', {
  default: null,
})
const isOpen = ref(false)
const filterQuery = ref('')
const filterInputRef = ref<InstanceType<typeof UiInput> | null>(null)

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

const selectSize = computed(() => computedSize.value)
const isMultiple = computed(() => 'multiple' in attrs)
const isFilterable = computed(() => props.filterable)

const selectClasses = computed(() => {
  return {
    'select': true,
    [`select--${selectSize.value}`]: true,
    'select--multiple': isMultiple.value,
    'select--accent': props.accent,
    'select--stateless': props.stateless,
  }
})

const iconSize = computed(() => {
  switch (selectSize.value) {
    case 'tiny': return 16
    case 'large': return 40
    default: return 24
  }
})

const checkboxSize = computed(() => {
  switch (selectSize.value) {
    case 'tiny':
    case 'small':
      return 'medium'
    default:
      return 'large'
  }
})

const optionsMap = computed(() => {
  const object: Record<string | number, string> = {}
  const options = (attrs.options as SelectOption[]) || []

  options.forEach((option) => {
    if (option.type === 'group' && Array.isArray(option.children)) {
      option.children.forEach((child: SelectOption) => {
        const value = child.value
        const label = child.label

        if (value !== undefined && label !== undefined) {
          object[value] = typeof label === 'string' ? label : String(label)
        }
      })
    } else if (option.value !== undefined && option.label !== undefined) {
      object[option.value] = typeof option.label === 'string' ? option.label : String(option.label)
    }
  })

  return object
})

const matchesQuery = (label: unknown, query: string) => {
  if (!label || typeof label === 'function') return !query

  return !query || String(label).toLowerCase().includes(query)
}

const filteredOptions = computed(() => {
  const options = (attrs.options as SelectOption[]) || []
  const query = filterQuery.value.toLowerCase()

  if (!query) return options

  const filtered: SelectOption[] = []

  options.forEach((option) => {
    if (option.type === 'group' && Array.isArray(option.children)) {
      const filteredChildren = option.children.filter((child: SelectOption) => matchesQuery(child.label, query))

      if (filteredChildren.length > 0) {
        filtered.push({ ...option, children: filteredChildren })
      }
    } else if (matchesQuery(option.label, query)) {
      filtered.push(option)
    }
  })

  return filtered
})

const handleDropdownToggle = (show: boolean) => {
  if (show) {
    filterQuery.value = ''

    if (isFilterable.value) {
      setTimeout(() => {
        filterInputRef.value?.$el?.querySelector('input')?.focus()
      }, 50)
    }
  }
}

const handleClick = () => {
  // placeholder for future bottom sheet support
}

const renderTag = ({ option }: { option: SelectOption }) => {
  if (!Array.isArray(selectedValues.value)) {
    return h('span', option.label as string)
  }

  return selectedValues.value.map((el) => optionsMap.value[el]).join(', ')
}

const renderLabel = (option: SelectOption) => {
  if (option.type === 'group') {
    return h('span', option.label as string)
  }

  if (isMultiple.value) {
    const isChecked = Array.isArray(selectedValues.value) && selectedValues.value.includes(option.value!)

    return h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
        },
      },
      [
        h(UiCheckbox, {
          modelValue: isChecked,
          size: checkboxSize.value as 'medium' | 'large',
          style: {
            pointerEvents: 'none',
          },
        }),
        h('span', option.label as string),
      ],
    )
  }

  return h('span', option.label as string)
}

defineOptions({
  inheritAttrs: false,
})
</script>

<style scoped lang="scss">
@use 'sass:map';

$select-sizes: (
  'tiny': (
    'font-size': 12px,
    'border-radius': 6px,
    'padding-right': 28px,
    'padding': 8px,
    'option-height': 24px,
    'grouped-padding': 16px,
    'option-border-radius': 4px,
    'loader-size': 16px,
    'loader-right': 8px,
  ),
  'small': (
    'font-size': 14px,
    'border-radius': 6px,
    'padding-right': 36px,
    'padding': 12px,
    'option-height': 32px,
    'grouped-padding': 20px,
    'option-border-radius': 4px,
    'loader-size': 20px,
    'loader-right': 12px,
  ),
  'medium': (
    'font-size': 16px,
    'border-radius': 8px,
    'padding-right': 44px,
    'padding': 16px,
    'option-height': 40px,
    'grouped-padding': 28px,
    'option-border-radius': 4px,
    'loader-size': 24px,
    'loader-right': 16px,
  ),
  'large': (
    'font-size': 16px,
    'border-radius': 12px,
    'padding-right': 44px,
    'padding': 24px,
    'option-height': 48px,
    'grouped-padding': 40px,
    'option-border-radius': 8px,
    'loader-size': 24px,
    'loader-right': 16px,
  ),
);

.form-item {
  :deep(.n-base-selection__border) {
    border-width: 2px !important;
    box-shadow: none !important;
    transition: opacity .3s ease;
  }

  :deep(.n-base-selection__state-border) {
    border-width: 2px !important;
    box-shadow: none !important;
  }

  :deep(.n-base-selection:not(.n-base-selection--disabled):hover),
  :deep(.n-base-selection.n-base-selection--focus),
  :deep(.n-base-selection.n-base-selection--active),
  :deep(.n-base-selection.n-base-selection--error-status),
  :deep(.n-base-selection.n-base-selection--warning-status) {
    .n-base-selection__border {
      opacity: 0;
    }
  }

  &:has(.select--accent) {
    :deep(.n-base-selection:not(.n-base-selection--disabled)) {
      .n-base-selection__border {
        border-color: var(--color-primary) !important;
      }
    }
  }

  :deep(.n-base-clear__placeholder) {
    width: 100%;
    height: 100%;
  }

  :deep(.n-base-select-option--selected) {
    &:before {
      border: 1px solid var(--blue-50);
    }
  }

  :deep(.n-base-select-group-header) {
    font-weight: 700;
    color: var(--grey-700);
  }

  :deep(.n-base-select-menu) {
    margin-top: 8px;
    margin-bottom: 8px;
    overflow: hidden;
    border: 2px solid var(--color-primary);

    .n-base-select-menu__header {
      border-bottom: none;
    }
  }

  :deep(.n-base-selection-tag-wrapper) {
    padding-bottom: 0;
    display: block;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;

    &:not(:first-child) {
      display: none;
    }
  }

  &:has(.select--multiple) {
    :deep(.n-base-select-option--selected) {
      &:before {
        background: transparent !important;
        border: none !important;
      }

      color: var(--color-text) !important;
    }

    :deep(.n-base-select-option--pending) {
      &:before {
        background: var(--blue-50) !important;
      }
    }
  }

  @each $size, $config in $select-sizes {
    &:has(.select--#{$size}) {
      :deep(.n-base-selection) {
        font-size: #{map.get($config, 'font-size')};
        border-radius: #{map.get($config, 'border-radius')};
      }

      :deep(.n-base-select-menu) {
        border-radius: #{map.get($config, 'border-radius')};
      }

      :deep(.n-base-selection-placeholder.n-base-selection-overlay),
      :deep(.n-base-selection-input),
      :deep(.n-base-selection-label__render-label),
      :deep(.n-base-selection-tags) {
        padding: 0 #{map.get($config, 'padding-right')} 0 #{map.get($config, 'padding')} !important;
      }

      :deep(.n-base-select-group-header),
      :deep(.n-base-select-option) {
        padding-left: #{map.get($config, 'padding')} !important;
        padding-right: #{map.get($config, 'padding')} !important;
        font-size: #{map.get($config, 'font-size')} !important;
      }

      :deep(.n-base-select-option--grouped) {
        padding-left: #{map.get($config, 'grouped-padding')} !important;
      }

      :deep(.n-base-select-option--selected),
      :deep(.n-base-select-option--pending) {
        &:before {
          border-radius: #{map.get($config, 'option-border-radius')} !important;
        }
      }

      :deep(.n-base-loading.n-base-suffix) {
        width: #{map.get($config, 'loader-size')};
        height: #{map.get($config, 'loader-size')};
        right: #{map.get($config, 'loader-right')};
      }
    }
  }
}

.select {
  &:deep(.n-base-suffix__arrow) {
    .select-arrow {
      transition: transform 0.3s ease;
    }
  }

  &:deep(.n-base-loading.n-base-suffix) {
    * {
      width: 100%;
      height: 100%;
    }
  }

  &:where(.select--stateless) {
    &:deep(.n-base-selection__border),
    &:deep(.n-base-selection__state-border) {
      display: none;
    }

    &:deep(.n-base-selection) {
      background: transparent;
    }
  }
}
</style>
