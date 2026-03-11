<template>
  <n-button
    :size="computedSize"
    :class="buttonClasses"
    :attr-type="submit ? 'submit' : 'button'"
    :text="isTextType || undefined"
    :type="nButtonType"
  >
    <template #icon v-if="$attrs.icon">
      <ui-icon
        v-if="$attrs.icon"
        :name="($attrs.icon as IconName)"
        :size="computedIconSize"
        :color="iconBg || 'currentColor'"
      />
    </template>
    <slot />
  </n-button>
</template>

<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue'
import { NButton } from 'naive-ui'
import { UiIcon } from '@fastio/icons'
import { useResponsiveSize } from '@fastio/kit'
import type { Size, ResponsiveSizeMap } from '@fastio/kit'
import type { IconName } from '@fastio/icons'

type Props = {
  size?: Size
  responsive?: ResponsiveSizeMap
  submit?: boolean
  fullWidth?: boolean
  iconBg?: string
  iconFg?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  submit: false,
})
const attrs = useAttrs()
const slots = useSlots()

const isIconOnly = computed(() => {
  return attrs.icon && (!slots.default || !slots.default().length)
})

const isTextType = computed(() => attrs.type === 'text' || attrs.hasOwnProperty('text'))
const nButtonType = computed(() => {
  if (attrs.type === 'text') return 'default' as const
  return attrs.type as 'default' | 'primary' | 'tertiary' | 'error' | 'warning' | 'success' | 'info' | undefined
})

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

const buttonClasses = computed(() => ({
  'full-width': props.fullWidth,
  'icon-only': isIconOnly.value,
}))

const computedIconSize = computed(() => {
  switch (computedSize.value) {
    case 'tiny':
    case 'small':
      return 16
    case 'medium':
    case 'large':
    default:
      return 24
  }
})
</script>

<style scoped lang="scss">
.n-button {
  &:where(.icon-only) {
    aspect-ratio: 1;
    padding: 0 !important;
  }

  &:where(.full-width) {
    width: 100%;
  }
}
</style>
