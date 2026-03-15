<template>
  <div class="hero-root" :class="`hero--${hero.size}`" :style="heroStyle">
    <div v-if="hero.bgType === 'image' && heroContent?.bgUrl" class="bg" :style="bgStyle" />
    <div v-if="hero.bgType === 'image' && heroContent?.bgUrl" class="overlay" :style="overlayStyle" />
    <div v-if="hero.bgType === 'gradient'" class="gradient" :style="gradientStyle" />
    <div v-if="hero.bgType === 'gradient'" class="overlay" :style="overlayStyle" />
    <div class="content" :style="contentStyle" v-html="safeContent" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DOMPurify from 'dompurify'
import { getHeroGradient, heroContentPositionStyle } from '@fastio/shared'
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

const gradientStyle = computed(() => {
  const gradient = getHeroGradient(props.hero.gradientId ?? 'diag-bp')
  return { background: gradient?.css ?? '' }
})

const overlayStyle = computed(() => ({
  background: props.hero.overlayColor,
  opacity: props.hero.overlayOpacity,
}))

const contentStyle = computed(() => ({
  ...heroContentPositionStyle(props.hero.contentPosition ?? 5),
  textAlign: props.hero.contentAlign ?? 'left',
}))
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

.gradient {
  position: absolute;
  inset: 0;
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
