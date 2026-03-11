<template>
  <n-skeleton
    :class="skeletonClasses"
    v-bind="$attrs"
    :animated="animated"
    :text="text"
    :round="round"
    :circle="circle"
    :sharp="sharp"
    :repeat="repeat"
    :width="width"
    :height="height"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NSkeleton } from 'naive-ui'
import { useResponsiveSize } from '@fastio/kit'
import type { Breakpoint } from '@fastio/kit'

type SkeletonSize = 'small' | 'medium' | 'large'
type SkeletonResponsiveMap = Partial<Record<Breakpoint, SkeletonSize>>

type Props = {
  size?: SkeletonSize
  responsive?: SkeletonResponsiveMap
  text?: boolean
  round?: boolean
  circle?: boolean
  sharp?: boolean
  repeat?: number
  width?: string | number
  height?: string | number
  animated?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  animated: true,
  repeat: 1,
})

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

const skeletonClasses = computed(() => {
  return {
    [`size-${computedSize.value}`]: true,
  }
})
</script>

<style scoped lang="scss">
@use 'sass:map';

$skeleton-sizes: (
  'small': ('height': 20px, 'border-radius': 6px),
  'medium': ('height': 24px, 'border-radius': 8px),
  'large': ('height': 32px, 'border-radius': 10px),
);

.n-skeleton {
  @each $size, $props in $skeleton-sizes {
    &:where(.size-#{$size}) {
      height: map.get($props, 'height');
      border-radius: map.get($props, 'border-radius');
    }
  }
}
</style>
