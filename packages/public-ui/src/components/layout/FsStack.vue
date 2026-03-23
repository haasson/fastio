<template>
  <div class="fs-stack-root" :class="classes" :style="gapStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Props = {
  direction?: 'col' | 'row'
  gap?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between'
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'col',
})

const classes = computed(() => ({
  [`dir-${props.direction}`]: true,
  [`align-${props.align}`]: !!props.align,
  [`justify-${props.justify}`]: !!props.justify,
}))

const gapStyle = computed(() =>
  props.gap != null ? { gap: `${props.gap}px` } : undefined
)
</script>

<style scoped lang="scss">
.fs-stack-root {
  display: flex;

  &.dir-col { flex-direction: column; }
  &.dir-row { flex-direction: row; align-items: center; }

  &.align-start   { align-items: flex-start; }
  &.align-center  { align-items: center; }
  &.align-end     { align-items: flex-end; }
  &.align-stretch { align-items: stretch; }

  &.justify-start   { justify-content: flex-start; }
  &.justify-center  { justify-content: center; }
  &.justify-end     { justify-content: flex-end; }
  &.justify-between { justify-content: space-between; }
}
</style>
