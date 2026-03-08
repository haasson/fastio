<template>
  <n-timeline :size="size" class="timeline-root">
    <slot />
  </n-timeline>
</template>

<script setup lang="ts">
import { NTimeline } from 'naive-ui'

type Props = {
  size?: 'medium' | 'large'
}

withDefaults(defineProps<Props>(), {
  size: 'medium',
})
</script>

