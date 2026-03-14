<template>
  <n-tag
    :type="type"
    :size="computedSize"
    :class="tagClasses"
    :color="tagColor"
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
      <ui-icon name="close" :size="iconSize" />
    </ui-button>
  </n-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NTag, type TagProps } from 'naive-ui'
import { UiIcon } from '@fastio/icons'
import UiButton from './UiButton.vue'
import { useResponsiveSize } from '@fastio/kit'
import type { Size, ResponsiveSizeMap } from '@fastio/kit'
import type { IconName } from '@fastio/icons'

type TagType = 'default' | 'primary' | 'success' | 'warning' | 'error'

type Props = {
  type?: TagType
  empty?: boolean
  secondary?: boolean
  hoverable?: boolean
  closable?: boolean
  square?: boolean
  icon?: IconName
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

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  primary: { bg: 'var(--color-primary)', text: '#fff' },
  success: { bg: 'var(--color-success)', text: '#fff' },
  warning: { bg: 'var(--yellow-600)', text: '#fff' },
  error:   { bg: 'var(--color-error)', text: '#fff' },
}

const tagColor = computed(() => {
  const c = TAG_COLORS[props.type]
  if (!c) return undefined

  if (props.empty) {
    return { color: 'transparent', textColor: c.bg, borderColor: c.bg }
  }

  return { color: c.bg, textColor: c.text, borderColor: c.bg }
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
      return 10
    case 'small':
      return 12
    case 'medium':
      return 16
    case 'large':
    default:
      return 20
  }
})
</script>

<style scoped lang="scss">
:deep(.n-tag__content) {
  display: inline-flex;
  align-items: center;
}

:deep(.n-tag__border) {
  transition: border-color 0.15s !important;
}

.tag-close {
  margin-left: 2px;
  padding: 0 !important;
  min-width: unset !important;
  height: unset !important;
  line-height: 1 !important;
}

.tag--hoverable {
  cursor: pointer;
  transition: filter 0.15s;

  &:hover {
    filter: brightness(0.95);
  }

  &:not(.tag--empty):hover {
    filter: brightness(1.1);
  }
}
</style>
