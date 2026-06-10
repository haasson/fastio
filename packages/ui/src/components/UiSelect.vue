<template>
  <client-only :class="wrapperClass">
    <form-item
      :label="label"
      :size="computedSize"
      :name="name"
      :rules="rules"
      :message="message"
      :model-value="selectedValues"
      :help="help"
      v-slot="{ hasError }"
    >
      <n-select
        v-model:value="selectedValues"
        v-model:show="isOpen"
        :size="computedSize"
        class="select"
        :show-checkmark="false"
        :consistent-menu-width="false"
        :max-tag-count="isMultiple ? 'responsive' : 1"
        :status="hasError ? 'error' : undefined"
        :options="filteredOptions"
        v-bind="selectAttrs"
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
        <template v-if="props.filterable" #header>
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
import { computed, ref, useAttrs } from 'vue'
import { NSelect, type SelectOption } from 'naive-ui'
import { UiIcon } from '@fastio/icons'
import UiInput from './UiInput.vue'
import ClientOnly from './internal/ClientOnly.vue'
import FormItem from './internal/FormItem.vue'
import { useResponsiveSize } from '@fastio/kit'
import type { ResponsiveSizeMap, Size } from '@fastio/kit'
import type { ValidationRule } from '@fastio/kit'

export type UiSelectProps = {
  label?: string
  message?: string
  size?: Size
  responsive?: ResponsiveSizeMap
  name?: string
  rules?: ValidationRule[]
  filterable?: boolean
  help?: string
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

const iconSize = computed(() => {
  switch (computedSize.value) {
    case 'tiny': return 16
    case 'large': return 40
    default: return 24
  }
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

    if (props.filterable) {
      setTimeout(() => {
        filterInputRef.value?.$el?.querySelector('input')?.focus()
      }, 50)
    }
  }
}

defineOptions({
  inheritAttrs: false,
})
</script>

