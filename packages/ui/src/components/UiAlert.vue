<template>
  <n-alert :class="alertClasses" :bordered="false" :show-icon="!!icon">
    <template v-if="icon" #icon>
      <ui-icon
        :name="icon"
        :size="computedIconSize"
        :bg="iconBg || 'currentColor'"
        :fg="iconFg"
      />
    </template>
    <slot />
  </n-alert>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NAlert } from 'naive-ui'
import UiIcon from './UiIcon.vue'
import useResponsiveSize from '../composables/useResponsiveSize'
import type { Size, ResponsiveSizeMap } from '../types/responsive'

type Props = {
  size?: Size
  responsive?: ResponsiveSizeMap
  inline?: boolean
  icon?: string
  iconBg?: string
  iconFg?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  inline: false,
})

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

const alertClasses = computed(() => {
  return {
    'alert-inline': props.inline,
    'has-icon': !!props.icon,
    [`size-${computedSize.value}`]: true,
  }
})

const computedIconSize = computed(() => {
  switch (computedSize.value) {
    case 'medium':
    case 'large':
      return 32
    default:
      return 24
  }
})
</script>

<style scoped lang="scss">
@use 'sass:map';

$alert-sizes: (
  'tiny': (
    'icon-margin': 8px 8px 0 12px,
    'body-padding': 8px 12px,
    'body-padding-left-icon': 44px,
    'line-height': 24px,
  ),
  'small': (
    'icon-margin': 12px 8px 0 16px,
    'body-padding': 12px 16px,
    'body-padding-left-icon': 48px,
    'line-height': 24px,
  ),
  'medium': (
    'icon-margin': 12px 12px 0 16px,
    'body-padding': 12px 16px,
    'body-padding-left-icon': 60px,
    'line-height': 32px,
  ),
  'large': (
    'icon-margin': 20px 20px 0 24px,
    'body-padding': 20px 24px,
    'body-padding-left-icon': 100px,
    'line-height': 32px,
  ),
);

.n-alert {
  @each $size, $props in $alert-sizes {
    &:where(.size-#{$size}) {
      &:deep(.n-alert-body) {
        padding: map.get($props, 'body-padding');
      }

      &:deep(.n-alert-body__title) {
        line-height: map.get($props, 'line-height');
      }

      &:deep(.n-alert-body__content) {
        line-height: map.get($props, 'line-height');
      }

      &:deep(.n-alert-body__title + .n-alert-body__content) {
        line-height: inherit;
      }

      &:deep(.n-alert__icon) {
        margin: map.get($props, 'icon-margin');
      }

      &.has-icon:deep(.n-alert-body) {
        padding-left: map.get($props, 'body-padding-left-icon');
      }
    }
  }

  &:where(.alert-inline) {
    display: inline-block;
    width: auto;
  }

  &:deep(.n-alert__icon) {
    width: auto;
    height: auto;
  }
}
</style>
