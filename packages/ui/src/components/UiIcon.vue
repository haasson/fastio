<template>
  <component
    :is="iconComponent"
    v-if="iconComponent"
    :width="iconSize"
    :height="iconSize"
    :style="combinedStyles"
    class="icon-root"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue'
import useBreakpoints from '../composables/useBreakpoints'

type ResponsiveSizes = {
  s?: number
  m?: number
  l?: number
  xl?: number
}

// Явный glob — Vite статически резолвит все иконки на этапе сборки (без 404 в проде)
const iconModules = import.meta.glob<Component>('../static/icons/*.vue')

// Кэш для async-компонентов иконок — предотвращает пересоздание обёрток при повторных маунтах
const iconCache = new Map<string, Component>()

interface Props {
  name: string
  size?: number | ResponsiveSizes
  bg?: string
  fg?: string
  flipX?: boolean
  flipY?: boolean
  rotate?: number
}

const props = withDefaults(defineProps<Props>(), {
  size: 24,
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

const colorStyles = computed(() => ({
  '--icon-bg': toColor(props.bg),
  '--icon-fg': toColor(props.fg),
}))

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

const iconSize = computed(() => {
  return isResponsive.value ? currentSize.value : props.size
})

const responsiveStyles = computed(() => {
  if (!isResponsive.value) return

  return {
    width: `${currentSize.value}px`,
    height: `${currentSize.value}px`,
  }
})

const styleTransform = computed(() => {
  const params: string[] = []

  if (props.flipX) params.push('scaleX(-1)')
  if (props.flipY) params.push('scaleY(-1)')
  if (props.rotate) params.push(`rotate(${props.rotate}deg)`)

  return params.length === 0 ? {} : { transform: params.join(' ') }
})

const combinedStyles = computed(() => ({
  ...responsiveStyles.value,
  ...styleTransform.value,
  ...colorStyles.value,
}))

const iconComponent = computed(() => {
  if (!props.name) return null

  const iconName = props.name.charAt(0).toUpperCase() + props.name.slice(1) + 'Icon'

  const cached = iconCache.get(iconName)
  if (cached) return cached

  const path = `../static/icons/${iconName}.vue`
  const loader = iconModules[path]

  if (!loader) {
    console.warn(`Icon ${iconName} not found`)
    return null
  }

  const component = defineAsyncComponent(loader as () => Promise<Component>)
  iconCache.set(iconName, component)

  return component
})

defineOptions({ inheritAttrs: false })
</script>

<style lang="scss" scoped>
.icon-root {
  display: block;
  flex-shrink: 0;
  transition: 0.2s;
}
</style>
