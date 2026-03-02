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
        :name="$attrs.icon as string"
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
import UiIcon from './UiIcon.vue'
import useResponsiveSize from '../composables/useResponsiveSize'
import type { Size, ResponsiveSizeMap } from '../types/responsive'

type Props = {
  darkSide?: boolean
  size?: Size
  responsive?: ResponsiveSizeMap
  submit?: boolean
  fullWidth?: boolean
  iconBg?: string
  iconFg?: string
  mainFont?: boolean
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
  'dark-side': props.darkSide,
  'full-width': props.fullWidth,
  'main-font': props.mainFont,
  [`type-${attrs.type === 'text' ? 'default' : (attrs.type || 'default')}`]: true,
  'text-button': isTextType.value,
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
  font-family: var(--secondary-font);

  &:where(.main-font) {
    font-family: var(--main-font);
  }

  &:deep(.n-base-wave),
  &:deep(.n-button__border),
  &:deep(.n-button__state-border) {
    display: none;
  }

  &:where(.type-default) {
    background-color: var(--color-white);
    color: var(--color-primary);
    border: 2px solid var(--color-primary);

    &:hover:not(.n-button--disabled):not(.n-button--loading) {
      color: var(--blue-400);
      border-color: var(--blue-400);
    }
    &:focus-visible {
      background-color: var(--blue-50);
    }
  }

  &:where(.type-default.text-button) {
    border: none;
    background-color: transparent;

    &:hover:not(.n-button--disabled):not(.n-button--loading) {
      color: var(--blue-400);
    }
    &:focus-visible {
      color: var(--blue-700);
    }
  }

  &:where(.type-default.dark-side) {
    background-color: transparent;
    color: var(--color-white);
    border-color: var(--color-white);

    &:hover:not(.n-button--disabled):not(.n-button--loading) {
      color: var(--blue-300);
      border-color: var(--blue-300);
    }
    &:focus-visible {
      background-color: var(--color-primary);
    }
  }

  &:where(.type-default.dark-side.text-button) {
    background-color: transparent;

    &:hover:not(.n-button--disabled):not(.n-button--loading) {
      color: var(--blue-100);
    }
    &:focus-visible {
      color: var(--blue-300);
    }
  }

  &:where(.type-primary) {
    border: 2px solid transparent;

    &:hover:not(.n-button--disabled):not(.n-button--loading) {
      background-color: var(--blue-400);
    }
    &:focus:not(:hover) {
      background-color: var(--color-primary);
      color: var(--color-white);
    }
    &:focus-visible:not(:hover) {
      background-color: var(--blue-700);
      color: var(--color-white);
    }
    &.n-button--disabled:hover,
    &.n-button--loading:hover {
      background-color: var(--color-primary);
    }
  }

  &:where(.type-primary.dark-side) {
    background-color: var(--color-white);
    color: var(--color-primary);

    &:hover:not(.n-button--disabled):not(.n-button--loading) {
      background-color: var(--blue-100);
      color: var(--color-primary);
    }
    &:focus:not(:hover) {
      background-color: var(--color-white);
      color: var(--color-primary);
    }
    &:focus-visible:not(:hover) {
      background-color: var(--blue-300);
      color: var(--grey-900);
    }
  }

  &:where(.type-tertiary) {
    background-color: var(--bg-page);
    color: var(--grey-900);
    border: 2px solid var(--grey-200);
    font-family: var(--main-font);

    &:hover:not(.n-button--disabled):not(.n-button--loading) {
      background-color: var(--bg-page);
      color: var(--color-primary);
    }
    &:focus-visible {
      background-color: var(--bg-page);
      color: var(--grey-900);
      border-color: var(--color-primary);
    }
  }

  &:where(.type-tertiary.text-button) {
    background-color: transparent;
    border: none;
    color: var(--grey-900);

    &:hover:not(.n-button--disabled):not(.n-button--loading) {
      color: var(--grey-700);
    }
    &:focus-visible {
      color: var(--grey-700);
    }
  }

  &:where(.type-error) {
    border: 2px solid transparent;

    &:focus:not(:hover) {
      background-color: var(--red-500);
    }
    &:focus-visible:not(:hover) {
      background-color: var(--red-700);
    }
  }

  &:where(.n-button--loading) {
    &:deep(.n-button__icon) {
      position: absolute;
      margin: 0;
      transition: none;
    }
    &:deep(.n-button__content) {
      opacity: 0;
    }
  }

  &:where(.n-button--disabled) {
    &:deep(.n-button__border) {
      border: inherit !important;
    }
  }

  &:where(.icon-only) {
    aspect-ratio: 1;
    padding: 0 !important;
  }

  &:where(.full-width) {
    width: 100%;
  }
}
</style>
