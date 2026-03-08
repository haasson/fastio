<template>
  <n-timeline-item :color="color" :line-type="lineType">
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
    <template v-if="title || $slots.header" #header>
      <slot name="header">{{ title }}</slot>
    </template>
    <template v-if="$slots.default" #default>
      <slot />
    </template>
    <template v-if="time || $slots.footer" #footer>
      <slot name="footer">{{ time }}</slot>
    </template>
  </n-timeline-item>
</template>

<script setup lang="ts">
import { NTimelineItem } from 'naive-ui'

type Props = {
  color?: string
  title?: string
  time?: string
  lineType?: 'default' | 'dashed'
}

withDefaults(defineProps<Props>(), {
  lineType: 'dashed',
})
</script>
