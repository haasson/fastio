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
        class="select"
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
              color="blue-500"
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
import ClientOnly from './internal/ClientOnly.vue'
import FormItem from './internal/FormItem.vue'
import useResponsiveSize from '../composables/useResponsiveSize'
import type { ResponsiveSizeMap, Size } from '../types/responsive'
import type { ValidationRule } from '../types/form'
import UiCheckbox from './UiCheckbox.vue'

export type UiSelectProps = {
  label?: string
  size?: Size
  responsive?: ResponsiveSizeMap
  name?: string
  rules?: ValidationRule[]
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

const isMultiple = computed(() => 'multiple' in attrs)
const isFilterable = computed(() => props.filterable)

const iconSize = computed(() => {
  switch (computedSize.value) {
    case 'tiny': return 16
    case 'large': return 40
    default: return 24
  }
})

const checkboxSize = computed(() => {
  switch (computedSize.value) {
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

