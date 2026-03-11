<template>
  <picture class="picture-root">
    <source
      v-for="source in sortedSources"
      :key="source.breakpoint"
      :media="`(min-width: ${source.minWidth}px)`"
      :srcset="source.src"
      type="image/webp"
    />
    <img :src="defaultSrc" v-bind="$attrs" />
  </picture>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBreakpoints } from '@fastio/kit'
import { BREAKPOINTS_ORDER } from '@fastio/kit'
import type { Breakpoint } from '@fastio/kit'

type SourceMap = Partial<Record<Breakpoint, string>>

export interface UiPictureProps {
  sources: SourceMap
}

const props = defineProps<UiPictureProps>()

const { breakpoints } = useBreakpoints()

interface SourceItem {
  breakpoint: Breakpoint
  src: string
  minWidth: number
}

const sortedSources = computed<SourceItem[]>(() => {
  const availableBreakpoints = BREAKPOINTS_ORDER.filter((bp) => props.sources[bp])
  const breakpointsForSources = availableBreakpoints.slice(1)

  return breakpointsForSources
    .map((bp) => ({
      breakpoint: bp,
      src: props.sources[bp]!,
      minWidth: breakpoints[bp],
    }))
    .reverse()
})

const defaultSrc = computed(() => {
  const fallback = BREAKPOINTS_ORDER.find((bp) => props.sources[bp])

  return fallback ? props.sources[fallback]! : ''
})

defineOptions({
  inheritAttrs: false,
})
</script>

<style scoped lang="scss">
.picture-root {
  display: contents;

  img {
    display: block;
    max-width: 100%;
    height: auto;
  }
}
</style>
