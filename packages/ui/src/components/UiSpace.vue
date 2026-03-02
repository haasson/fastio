<template>
  <n-space
    :size="computedSize"
    :wrap-item="false"
    :class="{ fill }"
    v-bind="$attrs"
  >
    <slot />
  </n-space>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NSpace } from 'naive-ui'
import useBreakpoints from '../composables/useBreakpoints'
import type { Breakpoint } from '../types/responsive'
import { BREAKPOINTS_ORDER } from '../types/responsive'

type ResponsiveSizeMap = Partial<Record<Breakpoint, number>>

export type UiSpaceProps = {
  size?: number
  responsive?: ResponsiveSizeMap
  fill?: boolean
}

const props = withDefaults(defineProps<UiSpaceProps>(), {
  size: 12,
  fill: false,
})

const { active } = useBreakpoints()

const computedSize = computed(() => {
  if (!props.responsive) {
    return props.size
  }

  const currentBreakpoint = active.value as Breakpoint
  const currentIndex = BREAKPOINTS_ORDER.indexOf(currentBreakpoint)

  for (let i = currentIndex; i >= 0; i--) {
    const bp = BREAKPOINTS_ORDER[i]

    if (props.responsive[bp] !== undefined) {
      return props.responsive[bp]
    }
  }

  return props.size
})
</script>

<style scoped lang="scss">
.n-space:where(.fill) {
  :deep(> *) {
    flex: 1;
  }
}
</style>
