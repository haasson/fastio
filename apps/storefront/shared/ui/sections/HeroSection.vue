<template>
  <div class="hero-root" :class="`hero--${hero.size}`" :style="heroStyle">
    <div v-if="hero.bgType === 'image' && heroContent?.bgUrl" class="bg" :style="bgStyle" />
    <div v-if="hero.bgType === 'image' && heroContent?.bgUrl" class="overlay" :style="overlayStyle" />
    <div v-if="hero.bgType === 'gradient'" class="gradient" :style="gradientStyle" />
    <div v-if="hero.bgType === 'gradient'" class="overlay" :style="overlayStyle" />
    <div class="content-wrap">
      <div class="content" :style="contentStyle">
        <div class="content-inner" v-html="safeContent" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getHeroGradient, heroContentPositionStyle } from '@fastio/shared'
import type { SiteLayout, SiteContent } from '@fastio/shared'
import { useSafeHtml } from '~/shared/composables/useSafeHtml'

const props = defineProps<{
  hero: SiteLayout['sections']['hero']
  heroContent: SiteContent['hero'] | null
  stickyHeight?: number
}>()

const safeContent = useSafeHtml(() => props.heroContent?.text ?? '')

const heroStyle = computed(() => {
  if (props.hero.size === 'fullscreen') {
    return { height: `calc(100dvh - ${props.stickyHeight ?? 0}px)` }
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

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

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

.content-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: 16px;
  box-sizing: border-box;

  @include md {
    padding-inline: 32px;
  }

  @include lg {
    padding-inline: 48px;
  }
}

.content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 32px 0;
}

.content-inner {
  zoom: 0.55;

  @include md { zoom: 0.75; }
  @include lg { zoom: 1; }

  :deep(h1), :deep(h2), :deep(h3), :deep(h4), :deep(h5), :deep(h6) {
    margin: 0 0 12px;
    font-family: var(--heading-font-family, var(--font-family, inherit));
    color: var(--color-text);
    line-height: 1.2;
    font-weight: 700;
  }

  :deep(p) {
    margin: 0 0 8px;
    font-family: var(--font-family, inherit);
    line-height: 1.6;
    font-weight: 400;
    color: var(--color-text);

    &:last-child { margin-bottom: 0; }
  }

  :deep(ul), :deep(ol) {
    padding-left: 20px;
    margin: 0 0 8px;
    font-family: var(--font-family, inherit);
    line-height: 1.6;
    color: var(--color-text);
  }

  :deep(ul) { list-style: disc; }
  :deep(ol) { list-style: decimal; }
  :deep(strong) { font-weight: 700; }
  :deep(em) { font-style: italic; }
}
</style>
