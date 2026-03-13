<template>
  <div class="hero-root" :class="`hero--${hero.size}`" :style="heroStyle">
    <div v-if="hero.bgType !== 'none' && heroContent?.bgUrl" class="bg" :style="bgStyle" />
    <div v-if="hero.bgType !== 'none' && heroContent?.bgUrl" class="overlay" :style="overlayStyle" />
    <div class="content" :style="contentStyle" v-html="safeContent" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import type { SiteLayout, SiteContent } from '@fastio/shared'

const props = defineProps<{
  hero: SiteLayout['sections']['hero']
  heroContent: SiteContent['hero'] | null
  stickyHeight?: number
}>()

const safeContent = computed(() => {
  if (import.meta.server) return props.heroContent?.text ?? ''

  return DOMPurify.sanitize(props.heroContent?.text ?? '')
})

const heroStyle = computed(() => {
  if (props.hero.size === 'fullscreen') {
    return { height: `calc(100vh - ${props.stickyHeight ?? 0}px)` }
  }

  return { minHeight: '320px' }
})

const bgStyle = computed(() => ({
  backgroundImage: `url('${props.heroContent?.bgUrl}')`,
}))

const overlayStyle = computed(() => ({
  background: props.hero.overlayColor,
  opacity: props.hero.overlayOpacity,
}))

// contentPosition 1–9: rows (top/mid/bot), cols (left/center/right)
const alignMap: Record<number, string> = {
  1: 'start', 2: 'start', 3: 'start',
  4: 'center', 5: 'center', 6: 'center',
  7: 'end', 8: 'end', 9: 'end',
}
const justifyMap: Record<number, string> = {
  1: 'start', 2: 'center', 3: 'end',
  4: 'start', 5: 'center', 6: 'end',
  7: 'start', 8: 'center', 9: 'end',
}

const contentStyle = computed(() => {
  const pos = props.hero.contentPosition ?? 5

  return {
    alignItems: alignMap[pos],
    justifyContent: justifyMap[pos],
    textAlign: props.hero.contentAlign ?? 'left',
  }
})
</script>

<style scoped>
.hero-root {
  position: relative;
  overflow: hidden;
  background: var(--color-surface);
}

.bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
}

.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 32px 20px;
  max-width: 1100px;
  margin: 0 auto;
}
</style>
