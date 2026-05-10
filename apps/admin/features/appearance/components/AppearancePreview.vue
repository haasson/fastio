<template>
  <div class="page-preview" :style="themeVars">
    <!-- Шапка -->
    <div class="preview-block preview-block--header">
      <div class="ph-logo" />
      <div v-if="layout.header.showNav && layout.header.navItems.length" class="ph-nav">
        <span v-for="item in layout.header.navItems" :key="item.key" class="ph-nav-label">
          {{ featureLabel(item.key) }}
        </span>
      </div>
      <div class="ph-header-right">
        <div v-if="layout.header.showWorkingHours || layout.header.showPhone" class="ph-venue-info">
          <div v-if="layout.header.showWorkingHours" class="ph-venue-line" />
          <div v-if="layout.header.showPhone" class="ph-venue-line ph-venue-line--bold" />
        </div>
        <div class="ph-cart">
          <UiIcon name="cart" :size="11" color="var(--color-text)" />
          <span class="ph-cart-badge" />
        </div>
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
          <div
            class="ph-hero-text"
            :style="{ textAlign: props.layout.sections.hero.contentAlign ?? 'left' }"
            v-html="content.hero.text"
          />
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
        <div v-for="i in 6" :key="i" class="ph-menu-card">
          <div class="ph-menu-card-photo" />
          <div class="ph-menu-card-body">
            <div class="ph-menu-card-title" />
            <div class="ph-menu-card-subtitle" />
            <div class="ph-menu-card-footer">
              <div class="ph-menu-card-price" />
              <div class="ph-menu-card-btn" />
            </div>
          </div>
        </div>
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

      <!-- TODO: vacancies preview — скрыто до реализации функционала -->
      <!-- <div v-else-if="key === 'vacancies'" class="preview-block preview-block&#45;&#45;vacancies">
        <div class="ph-section-title" />
        <div v-for="i in 2" :key="i" class="ph-vacancy-card" />
      </div> -->
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
import { UiIcon } from '@fastio/ui'
import type { SiteLayout, SiteContent, TenantTheme } from '@fastio/shared'
import { featureLabel, paletteToCssVars, getHeroGradient, heroContentPositionStyle } from '@fastio/shared'

const props = defineProps<{ layout: SiteLayout; content: SiteContent; theme: TenantTheme }>()

const btnRadiusMap: Record<string, string> = {
  square: '1px',
  rounded: '3px',
  pill: '999px',
}

const themeVars = computed(() => {
  if (!props.theme.palette) return {}
  const vars = paletteToCssVars(props.theme.palette)

  vars['--color-bg-card'] = props.theme.palette.surface
  vars['--color-text-secondary'] = props.theme.palette.textMuted
  vars['--preview-btn-radius'] = btnRadiusMap[props.theme.buttonRadius] ?? '6px'

  return vars
})

const heroBgStyle = computed(() => {
  const { bgType, gradientId } = props.layout.sections.hero
  const bgUrl = props.content.hero.bgUrl

  if (bgType === 'gradient') {
    const gradient = getHeroGradient(gradientId ?? 'diag-bp')

    return gradient ? { background: gradient.css } : {}
  }

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

const heroContentStyle = computed(() => heroContentPositionStyle(props.layout.sections.hero.contentPosition ?? 5),
)
</script>

<style scoped lang="scss">
/* Декоративный мини-превью storefront'а — все размеры и радиусы здесь
   подбираются визуально под масштаб скелетона, не под шкалу токенов */
/* stylelint-disable scale-unlimited/declaration-strict-value */
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
    background: var(--color-text-secondary);
  }
}

.ph-cart {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ph-cart-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--primary);
  border: 1px solid var(--color-bg-card);
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
  max-width: 80%;
  color: var(--color-text);
  zoom: 0.28;
  transform-origin: top left;
}

.ph-section-title {
  height: 6px;
  width: 40%;
  border-radius: 3px;
  background: var(--color-text-secondary);
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
  border-radius: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ph-menu-card-photo {
  width: 100%;
  aspect-ratio: 1;
  background: var(--color-border);
}

.ph-menu-card-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 4px;
}

.ph-menu-card-title {
  height: 4px;
  border-radius: 2px;
  background: var(--color-text);
  opacity: 0.5;
  width: 80%;
}

.ph-menu-card-subtitle {
  height: 3px;
  border-radius: 2px;
  background: var(--color-text);
  opacity: 0.25;
  width: 55%;
}

.ph-menu-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.ph-menu-card-price {
  height: 5px;
  width: 35%;
  border-radius: 2px;
  background: var(--color-text);
  opacity: 0.5;
}

.ph-menu-card-btn {
  height: 10px;
  width: 32%;
  border-radius: var(--preview-btn-radius, 3px);
  background: var(--primary);
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

/* TODO: vacancies styles — скрыто до реализации функционала */
/* .preview-block--vacancies {
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
} */

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
/* stylelint-enable scale-unlimited/declaration-strict-value */
</style>
