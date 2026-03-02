<template>
  <component
    :is="iconComponent"
    v-if="iconComponent"
    :size="currentSize"
    :color="resolvedColor"
    :stroke-width="strokeWidth"
    :style="styleTransform"
    class="icon-root"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import useBreakpoints from '../composables/useBreakpoints'
import { iconRegistry } from '../icons'
import type { IconName } from '../icons'

type ResponsiveSizes = {
  s?: number
  m?: number
  l?: number
  xl?: number
}

type Props = {
  name: IconName
  size?: number | ResponsiveSizes
  color?: string
  /** @deprecated используй color */
  bg?: string
  strokeWidth?: number
  flipX?: boolean
  flipY?: boolean
  rotate?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
  strokeWidth: 1.5,
})

const { xl, l, m } = useBreakpoints()

const isResponsive = computed(() => typeof props.size === 'object')

const currentSize = computed(() => {
  if (!isResponsive.value) return props.size as number

  const sizes = props.size as ResponsiveSizes

  if (xl.value && sizes.xl) return sizes.xl
  if (l.value && sizes.l) return sizes.l
  if (m.value && sizes.m) return sizes.m
  if (sizes.s) return sizes.s

  return 24
})

const toColor = (value?: string) => {
  if (!value) return undefined

  if (
    value.startsWith('#')
    || value.startsWith('rgb')
    || value.startsWith('hsl')
    || value.startsWith('var(')
    || ['currentColor', 'transparent', 'inherit', 'white', 'black'].includes(value)
  ) {
    return value
  }

  return `var(--${value})`
}

const resolvedColor = computed(() => toColor(props.color ?? props.bg))

const styleTransform = computed(() => {
  const params: string[] = []

  if (props.flipX) params.push('scaleX(-1)')
  if (props.flipY) params.push('scaleY(-1)')
  if (props.rotate) params.push(`rotate(${props.rotate}deg)`)

  return params.length === 0 ? {} : { transform: params.join(' ') }
})

const iconComponent = computed(() => iconRegistry[props.name] ?? null)

defineOptions({ inheritAttrs: false })
</script>

<style lang="scss" scoped>
.icon-root {
  display: block;
  flex-shrink: 0;
  transition: 0.2s;
}
</style>
