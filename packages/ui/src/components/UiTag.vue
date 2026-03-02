<template>
  <n-tag
    :size="computedSize"
    :class="tagClasses"
    :closable="false"
  >
    <template #avatar v-if="$slots.avatar || icon">
      <slot name="avatar">
        <ui-icon
          :name="icon!"
          :size="iconSize"
          :color="iconBg || 'currentColor'"
        />
      </slot>
    </template>
    <slot />
    <ui-button
      v-if="closable"
      class="tag-close"
      text
      :size="computedSize"
      @click="$emit('close', $event)"
    >
      <ui-icon name="crossRound" :size="24" />
    </ui-button>
  </n-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NTag, type TagProps } from 'naive-ui'
import UiIcon from './UiIcon.vue'
import UiButton from './UiButton.vue'
import useResponsiveSize from '../composables/useResponsiveSize'
import type { Size, ResponsiveSizeMap } from '../types/responsive'

type TagType = 'default' | 'primary' | 'success' | 'warning'

type Props = {
  type?: TagType
  empty?: boolean
  secondary?: boolean
  hoverable?: boolean
  closable?: boolean
  square?: boolean
  icon?: string
  iconBg?: string
  iconFg?: string
  size?: Size
  responsive?: ResponsiveSizeMap
} & /* @vue-ignore */ Omit<TagProps, 'type' | 'size' | 'closable'>

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  empty: false,
  secondary: false,
  size: 'medium',
})

defineEmits<{
  close: [event: MouseEvent]
}>()

const computedSize = useResponsiveSize({
  size: props.size,
  responsive: props.responsive,
})

const tagClasses = computed(() => {
  const classes = [`tag--${props.type}`, `tag--${computedSize.value}`]

  if (props.empty) classes.push('tag--empty')
  if (props.secondary) classes.push('tag--secondary')
  if (props.icon) classes.push('tag--has-icon')
  if (props.hoverable) classes.push('tag--hoverable')
  if (props.closable) classes.push('tag--closable')
  if (props.square) classes.push('tag--square')

  return classes
})

const iconSize = computed(() => {
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
@use 'sass:map';

$tag-sizes: (
  'tiny': ('height': 24px, 'padding': 0 8px, 'closable-padding': 0 4px 0 8px, 'round-icon-padding': 0 12px 0 8px),
  'small': ('height': 32px, 'padding': 0 12px, 'closable-padding': 0 6px 0 12px, 'round-icon-padding': 0 16px 0 12px),
  'medium': ('height': 40px, 'padding': 0 16px, 'closable-padding': 0 8px 0 16px, 'round-icon-padding': 0 24px 0 16px),
  'large': ('height': 48px, 'padding': 0 16px, 'closable-padding': 0 8px 0 16px, 'round-icon-padding': 0 32px 0 20px),
);

$tag-types: (
  'default': ('bg': var(--grey-200), 'color': var(--grey-900), 'border': var(--grey-200), 'empty-color': var(--grey-900), 'secondary-bg': var(--grey-50), 'secondary-color': var(--grey-900), 'secondary-border': var(--grey-50)),
  'primary': ('bg': var(--color-primary), 'color': var(--color-white), 'border': var(--color-primary), 'empty-color': var(--color-primary), 'secondary-bg': var(--blue-50), 'secondary-color': var(--grey-900), 'secondary-border': var(--blue-50)),
  'success': ('bg': var(--color-success), 'color': var(--color-white), 'border': var(--color-success), 'empty-color': var(--color-success), 'secondary-bg': var(--green-50), 'secondary-color': var(--grey-900), 'secondary-border': var(--green-50)),
  'warning': ('bg': var(--yellow-400), 'color': var(--color-white), 'border': var(--yellow-400), 'empty-color': var(--yellow-400), 'secondary-bg': var(--yellow-50), 'secondary-color': var(--grey-900), 'secondary-border': var(--yellow-50)),
);

.n-tag {
  border-radius: 8px;

  &:deep(.n-tag__content) {
    display: flex;
    align-items: center;
  }

  &:deep(.n-tag__border) {
    display: none;
    border-radius: inherit;
    border-width: 1px;
  }

  &.tag--empty:deep(.n-tag__border) {
    display: block;
  }

  &.n-tag--round {
    border-radius: 999px;
  }

  &.tag--has-icon {
    &:deep(.n-tag__avatar) {
      margin: 0 8px 0 0;
    }
  }

  @each $size, $props in $tag-sizes {
    &.tag--#{$size} {
      $height: map.get($props, 'height');
      @if $height { height: $height; }
      padding: map.get($props, 'padding');

      @if $size == 'large' {
        border-radius: 12px;
        font-size: 16px;

        &.n-tag--round { border-radius: 999px; }
      }

      &.tag--closable {
        padding: map.get($props, 'closable-padding');
      }

      &.n-tag--round.tag--has-icon {
        padding: map.get($props, 'round-icon-padding');
      }
    }
  }

  &.tag--square {
    aspect-ratio: 1;
    padding: 0;
    justify-content: center;
  }

  @each $type, $props in $tag-types {
    &:where(.tag--#{$type}) {
      background: map.get($props, 'bg');
      color: map.get($props, 'color');

      &:deep(.n-tag__border) {
        border-color: map.get($props, 'border');
      }
    }

    &:where(.tag--#{$type}.tag--empty) {
      background: transparent;
      color: map.get($props, 'empty-color');
    }

    &:where(.tag--#{$type}.tag--secondary) {
      background: map.get($props, 'secondary-bg');
      color: map.get($props, 'secondary-color');

      &:deep(.n-tag__border) {
        border-color: map.get($props, 'secondary-border');
      }
    }
  }

  &.tag--hoverable {
    cursor: pointer;

    &:deep(.n-tag__border) {
      transition: border-color 0.2s ease;
    }
  }

  &:where(.tag--primary.tag--secondary.tag--hoverable) {
    &:deep(.n-tag__border) {
      display: block;
      border-width: 2px;
      border-color: transparent;
    }

    &:hover:deep(.n-tag__border) {
      border-color: var(--color-primary);
    }
  }
}

.tag-close {
  margin-left: 4px;
  --icon-bg: var(--grey-100);
  --icon-fg: var(--grey-500);

  :deep(*) { transition: fill 0.2s ease; }

  &:hover {
    --icon-bg: var(--grey-200);
  }
}
</style>
