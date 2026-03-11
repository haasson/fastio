<template>
  <n-pagination
    v-model:page="currentPage"
    :page-slot="pageSlot"
    :size="naiveSize"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NPagination, type PaginationProps } from 'naive-ui'
import { useBreakpoints } from '@fastio/kit'
import type { Size, Breakpoint, ResponsiveSizeMap } from '@fastio/kit'
import { BREAKPOINTS_ORDER } from '@fastio/kit'

interface Props extends /* @vue-ignore */ Omit<PaginationProps, 'size'> {
  showArrows?: boolean
  pageSlot?: number
  size?: Size
  responsive?: ResponsiveSizeMap
}

const props = withDefaults(defineProps<Props>(), {
  showArrows: false,
  pageSlot: 7,
})

const currentPage = defineModel<number>('page', { required: true })

const { active } = useBreakpoints()

const computedSize = computed<Size>(() => {
  if (!props.responsive) {
    return props.size || 'medium'
  }

  const currentBreakpoint = active.value as Breakpoint
  const currentIndex = BREAKPOINTS_ORDER.indexOf(currentBreakpoint)

  for (let i = currentIndex; i >= 0; i--) {
    const bp = BREAKPOINTS_ORDER[i]

    if (props.responsive[bp] !== undefined) {
      return props.responsive[bp]
    }
  }

  return props.size || 'medium'
})

const naiveSize = computed(() => {
  if (computedSize.value === 'tiny') {
    return 'small'
  }

  return computedSize.value
})

defineOptions({
  inheritAttrs: false,
})
</script>

