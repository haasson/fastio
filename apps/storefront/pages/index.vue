<template>
  <div class="page-root">
    <!-- Липкий хэдер -->
    <div ref="headerRef" class="sticky-header">
      <SiteHeader :tenant="tenant" :header="layout.header" />
    </div>

    <!-- Липкая панель категорий -->
    <div
      v-if="layout.sections.categoryBar.enabled"
      class="sticky-category-bar"
      :style="{ top: `${headerHeight}px` }"
    >
      <CategoryBar :overflow="layout.sections.categoryBar.overflow" />
    </div>

    <!-- Динамические секции -->
    <template v-for="key in layout.sectionsOrder" :key="key">
      <HeroSection
        v-if="key === 'hero' && layout.sections.hero.enabled"
        :hero="layout.sections.hero"
        :hero-content="content.hero"
        :sticky-height="stickyTotalHeight"
      />
      <BannersSection v-else-if="key === 'banners' && layout.sections.banners.enabled" />
      <MenuSection
        v-else-if="key === 'menu' && layout.sections.menu.enabled"
        :default-view="layout.sections.menu.defaultView"
      />
      <GallerySection v-else-if="key === 'gallery' && layout.sections.gallery.enabled" />
      <ReviewsSection v-else-if="key === 'reviews' && layout.sections.reviews.enabled" />
    </template>

    <SiteFooter />
    <SfCartFab @click="navigateTo('/cart')" />
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useNuxtData, useAsyncData, useRequestFetch, useRoute, navigateTo } from 'nuxt/app'
import { useElementSize } from '@vueuse/core'
import type { Tenant } from '@fastio/shared'
import { defaultSiteLayout, defaultSiteContent, deepMerge } from '@fastio/shared'
import SiteHeader from '~/components/sections/SiteHeader.vue'
import CategoryBar from '~/components/sections/CategoryBar.vue'
import HeroSection from '~/components/sections/HeroSection.vue'
import BannersSection from '~/components/sections/BannersSection.vue'
import MenuSection from '~/components/sections/MenuSection.vue'
import GallerySection from '~/components/sections/GallerySection.vue'
import ReviewsSection from '~/components/sections/ReviewsSection.vue'
import SiteFooter from '~/components/sections/SiteFooter.vue'
import SfCartFab from '~/components/sf/domain/SfCartFab.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const rfetch = useRequestFetch()
const route = useRoute()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}
await useAsyncData('menu', () => rfetch('/api/menu', slugQuery))

type SiteLayout = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayout>)
)

type SiteContentType = ReturnType<typeof defaultSiteContent>

const content = computed(() =>
  deepMerge(defaultSiteContent(), (tenant.value?.siteContent ?? {}) as Partial<SiteContentType>)
)

const headerRef = useTemplateRef('headerRef')
const { height: headerHeight } = useElementSize(headerRef)

// Для Hero нужна высота липкого блока (хэдер + категории, если показана)
const CATEGORY_BAR_HEIGHT = 44 // px — синхронизировано с высотой CategoryBar
const categoryBarHeight = computed(() => layout.value.sections.categoryBar.enabled ? CATEGORY_BAR_HEIGHT : 0)
const stickyTotalHeight = computed(() => headerHeight.value + categoryBarHeight.value)
</script>

<style scoped>
.page-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.sticky-header {
  position: sticky;
  top: 0;
  z-index: 100;
}

.sticky-category-bar {
  position: sticky;
  z-index: 99;
}
</style>
