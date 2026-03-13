<template>
  <div class="page-preview">
    <!-- Шапка -->
    <div class="preview-block preview-block--header">
      <div class="ph-logo" />
      <div v-if="layout.header.showNav && layout.header.navItems.length" class="ph-nav">
        <span v-for="item in layout.header.navItems" :key="item.page" class="ph-nav-label">
          {{ featureLabel(item.page) }}
        </span>
      </div>
      <div class="ph-header-right">
        <div v-if="layout.header.showWorkingHours || layout.header.showPhone" class="ph-venue-info">
          <div v-if="layout.header.showWorkingHours" class="ph-venue-line" />
          <div v-if="layout.header.showPhone" class="ph-venue-line ph-venue-line--bold" />
        </div>
        <div class="ph-cart" />
      </div>
    </div>

    <!-- Секции в порядке sectionsOrder -->
    <template v-for="key in layout.sectionsOrder" :key="key">
      <div
        v-if="key === 'categoryBar'"
        class="preview-block preview-block--category-bar"
        :class="`preview-block--category-bar--${layout.sections.categoryBar.overflow}`"
      >
        <div v-for="i in 8" :key="i" class="ph-cat-pill" />
      </div>

      <div
        v-else-if="key === 'hero'"
        class="preview-block preview-block--hero"
        :class="{ 'preview-block--hero--compact': layout.sections.hero.size === 'content' }"
        :style="heroBgStyle"
      >
        <div class="ph-hero-overlay" :style="heroOverlayStyle" />
        <div class="ph-hero-inner" :style="heroContentStyle">
          <div class="ph-hero-text" :style="{ alignItems: heroTextAlign }">
            <div class="ph-text-line ph-text-line--title" />
            <div class="ph-text-line" />
            <div class="ph-text-line ph-text-line--short" />
          </div>
        </div>
      </div>

      <div
        v-else-if="key === 'banners'"
        class="preview-block preview-block--banners"
        :class="`preview-block--banners--${layout.sections.banners.displayMode}`"
      >
        <div v-if="layout.sections.banners.title" class="ph-section-title" />
        <div class="ph-banners-track">
          <div v-if="layout.sections.banners.displayMode === 'single'" class="ph-banner ph-banner--single" />
          <template v-else>
            <div class="ph-banner ph-banner--s" />
            <div class="ph-banner ph-banner--m" />
            <div class="ph-banner ph-banner--l" />
            <div class="ph-banner ph-banner--xl" />
          </template>
        </div>
      </div>

      <div v-else-if="key === 'menu'" class="preview-block preview-block--menu">
        <div v-for="i in 6" :key="i" class="ph-menu-card" />
      </div>

      <div v-else-if="key === 'gallery'" class="preview-block preview-block--gallery">
        <div
          v-for="i in 5"
          :key="i"
          class="ph-gallery-item"
          :class="`ph-gallery-item--${i}`"
        />
      </div>

      <div v-else-if="key === 'reviews'" class="preview-block preview-block--reviews">
        <div v-for="i in 3" :key="i" class="ph-review" />
      </div>

      <div v-else-if="key === 'delivery'" class="preview-block preview-block--delivery">
        <div class="ph-section-title" />
        <div v-for="i in 3" :key="i" class="ph-delivery-row" />
      </div>

      <div v-else-if="key === 'vacancies'" class="preview-block preview-block--vacancies">
        <div class="ph-section-title" />
        <div v-for="i in 2" :key="i" class="ph-vacancy-card" />
      </div>
    </template>

    <!-- Футер -->
    <div class="preview-block preview-block--footer">
      <div class="ph-footer-line" />
      <div class="ph-footer-line ph-footer-line--short" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SiteLayout, SiteContent } from '@fastio/shared'
import { featureLabel } from '@fastio/shared'

const props = defineProps<{ layout: SiteLayout; content: SiteContent }>()

const heroBgStyle = computed(() => {
  const { bgType } = props.layout.sections.hero
  const bgUrl = props.content.hero.bgUrl

  if (bgType !== 'none' && bgUrl) {
    return { backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }

  return {}
})

const heroTextAlign = computed(() => {
  const a = props.layout.sections.hero.contentAlign ?? 'left'

  return a === 'left' ? 'flex-start' : a === 'right' ? 'flex-end' : 'center'
})

const heroOverlayStyle = computed(() => ({
  background: props.layout.sections.hero.overlayColor,
  opacity: props.layout.sections.hero.overlayOpacity,
}))

const alignMap: Record<number, string> = {
  1: 'flex-start', 2: 'flex-start', 3: 'flex-start',
  4: 'center', 5: 'center', 6: 'center',
  7: 'flex-end', 8: 'flex-end', 9: 'flex-end',
}
const justifyMap: Record<number, string> = {
  1: 'flex-start', 2: 'center', 3: 'flex-end',
  4: 'flex-start', 5: 'center', 6: 'flex-end',
  7: 'flex-start', 8: 'center', 9: 'flex-end',
}

const heroContentStyle = computed(() => {
  const pos = props.layout.sections.hero.contentPosition ?? 5

  return { alignItems: alignMap[pos] ?? 'center', justifyContent: justifyMap[pos] ?? 'center' }
})
</script>

<style scoped lang="scss">
.page-preview {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
}

.preview-block {
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;

  &:last-child { border-bottom: none; }
}

.preview-block--header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: var(--color-bg-card);
}

.ph-logo {
  width: 22px;
  height: 9px;
  border-radius: 3px;
  background: var(--color-border);
  flex-shrink: 0;
}

.ph-nav {
  display: flex;
  gap: 6px;
  flex: 1;
  flex-wrap: wrap;
}

.ph-nav-label {
  font-size: 6px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.ph-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
}

.ph-venue-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-end;
}

.ph-venue-line {
  width: 28px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-border);

  &--bold {
    width: 36px;
    height: 5px;
    background: var(--color-text-tertiary);
  }
}

.ph-cart {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: var(--color-surface);
  flex-shrink: 0;
}

.preview-block--category-bar {
  display: flex;
  gap: 4px;
  padding: 6px 10px;
  background: var(--color-surface);

  &--scroll {
    overflow: hidden;
    flex-wrap: nowrap;
  }

  &--wrap {
    flex-wrap: wrap;
  }
}

.ph-cat-pill {
  height: 8px;
  width: 40px;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--color-border);
}

.preview-block--hero {
  height: 120px;

  &--compact { height: 60px; }
  background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-border) 100%);
  position: relative;
  overflow: hidden;
}

.ph-hero-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ph-hero-inner {
  position: absolute;
  inset: 0;
  display: flex;
  padding: 12px;
}

.ph-hero-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 70%;
}

.ph-text-line {
  width: 100%;
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.5);

  &--title {
    height: 8px;
    background: rgba(255, 255, 255, 0.75);
    width: 80%;
  }

  &--short {
    width: 50%;
  }
}

.ph-section-title {
  height: 6px;
  width: 40%;
  border-radius: 3px;
  background: var(--color-text-tertiary);
  margin-bottom: 6px;
}

.preview-block--banners {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
}

.ph-banners-track {
  display: flex;
  gap: 5px;
  overflow: hidden;
}

.ph-banner {
  flex-shrink: 0;
  height: 38px;
  border-radius: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);

  &--single { width: 100%; }
  &--s  { width: 52px; }
  &--m  { width: 68px; }
  &--l  { width: 80px; }
  &--xl { width: 90px; }
}

.preview-block--menu {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  padding: 8px 10px;
}

.ph-menu-card {
  height: 50px;
  border-radius: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.preview-block--gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 30px);
  gap: 4px;
  padding: 8px 10px;
}

.ph-gallery-item {
  border-radius: 3px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);

  &--1 { grid-row: span 2; }
}

.preview-block--reviews {
  display: flex;
  gap: 5px;
  padding: 8px 10px;
}

.ph-review {
  flex: 1;
  height: 44px;
  border-radius: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.preview-block--delivery {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
}

.ph-delivery-row {
  height: 14px;
  border-radius: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.preview-block--vacancies {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
}

.ph-vacancy-card {
  height: 28px;
  border-radius: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.preview-block--footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--color-surface);
}

.ph-footer-line {
  height: 5px;
  border-radius: 2px;
  background: var(--color-border);

  &--short { width: 60%; }
}
</style>
