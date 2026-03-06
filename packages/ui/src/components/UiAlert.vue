<template>
  <n-alert :class="alertClasses" :bordered="false" :show-icon="!!icon">
    <template v-if="icon" #icon>
      <ui-icon
        :name="icon"
        :size="computedIconSize"
        :color="iconBg || 'currentColor'"
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
import type { IconName } from '../icons'

type Props = {
  size?: Size
  responsive?: ResponsiveSizeMap
  inline?: boolean
  icon?: IconName
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
.n-alert {
  &:where(.alert-inline) {
    display: inline-block;
    width: auto;
  }
}
</style>
