<template>
  <component
    :is="tagName"
    class="link"
    :class="linkClasses"
    v-bind="linkAttrs"
  >
    <ui-icon
      v-if="icon && iconPosition === 'left'"
      :name="icon"
      :size="iconSize"
      class="icon"
    />
    <slot />
    <ui-icon
      v-if="icon && iconPosition === 'right'"
      :name="icon"
      :size="iconSize"
      class="icon"
    />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs, type Component } from 'vue'
import UiIcon from './UiIcon.vue'
import useBreakpoints from '../composables/useBreakpoints'
import type { ResponsiveSizeMap, Breakpoint } from '../types/responsive'
import { BREAKPOINTS_ORDER } from '../types/responsive'
import type { IconName } from '../icons'

type Size = 'tiny' | 'small' | 'medium'
type IconPosition = 'left' | 'right'

type Props = {
  size?: Size
  darkSide?: boolean
  icon?: IconName
  iconPosition?: IconPosition
  disabled?: boolean
  responsive?: boolean | ResponsiveSizeMap
  as?: string | Component
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  iconPosition: 'left',
  disabled: false,
})

const attrs = useAttrs()
const { active } = useBreakpoints()

const tagName = computed(() => {
  if (props.as) return props.as

  return 'a'
})

const linkAttrs = computed(() => {
  if (props.disabled) {
    return {
      'aria-disabled': 'true',
      'tabindex': -1,
    }
  }

  return attrs
})

const computedSize = computed<Size>(() => {
  if (props.responsive && typeof props.responsive === 'object') {
    const currentBreakpoint = active.value as Breakpoint
    const currentIndex = BREAKPOINTS_ORDER.indexOf(currentBreakpoint)

    for (let i = currentIndex; i >= 0; i--) {
      const bp = BREAKPOINTS_ORDER[i]

      if ((props.responsive as ResponsiveSizeMap)[bp] !== undefined) {
        return (props.responsive as ResponsiveSizeMap)[bp] as Size
      }
    }
  }

  return props.size
})

const linkClasses = computed(() => {
  return {
    [`size-${computedSize.value}`]: true,
    'responsive': props.responsive === true,
    'dark-side': props.darkSide,
    'disabled': props.disabled,
  }
})

const iconSize = computed(() => {
  switch (computedSize.value) {
    case 'tiny': return 16
    case 'small': return 20
    default: return 24
  }
})

defineOptions({
  inheritAttrs: false,
})
</script>

<style scoped lang="scss">
@use '../styles/mixins/media-queries' as *;

.link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  font-family: var(--main-font);
  color: var(--color-primary);
  text-decoration: none;
  cursor: pointer;
  transition:
    color 0.2s ease,
    opacity 0.2s ease;

  &:hover {
    opacity: 0.8;
  }

  &:focus-visible {
    opacity: 0.7;
    outline: none;
  }

  &:where(.dark-side) {
    color: var(--color-white);
  }

  &:where(.disabled) {
    color: var(--grey-300);
    cursor: not-allowed;
    pointer-events: none;
  }

  &:where(.size-tiny) {
    font-size: 12px;
    line-height: 1.33;
  }

  &:where(.size-small) {
    font-size: 14px;
    line-height: 1.42;
  }

  &:where(.size-medium) {
    font-size: 16px;
    line-height: 1.5;
  }

  &:where(.responsive.size-tiny) {
    @include mq-l {
      font-size: 14px;
      line-height: 1.42;
    }
  }

  &:where(.responsive.size-small) {
    @include mq-l {
      font-size: 16px;
      line-height: 1.5;
    }
  }

  &:where(.responsive.size-medium) {
    @include mq-l {
      font-size: 18px;
      line-height: 1.33;
    }
  }
}
</style>
