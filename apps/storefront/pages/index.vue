<template>
  <PageShell :show-category-bar="menuDefaultView === 'dishes'">
    <template #default="{ stickyTotalHeight, layout }">
      <HeroSection
        v-if="layout.sections.hero.enabled && layout.sectionsOrder.includes('hero')"
        id="hero"
        :hero="layout.sections.hero"
        :hero-content="content.hero"
        :sticky-height="stickyTotalHeight"
      />
      <BannersSection
        v-if="layout.sections.banners.enabled && layout.sectionsOrder.includes('banners')"
        id="banners"
        :banners="banners ?? []"
        :settings="layout.sections.banners"
      />
      <MenuSection
        v-if="layout.sections.menu.enabled && layout.sectionsOrder.includes('menu')"
        id="menu"
        :default-view="menuDefaultView"
        :dish-description-mode="layout.sections.menu.dishDescriptionMode"
        :mobile-dish-card="layout.sections.menu.mobileDishCard"
      />
      <GallerySection
        v-if="layout.sections.gallery.enabled && layout.sectionsOrder.includes('gallery') && layout.sections.gallery.galleryIds?.length"
        id="gallery"
        :galleries="galleries ?? []"
        :gallery-ids="layout.sections.gallery.galleryIds ?? []"
      />
      <ReviewsSection
        v-if="layout.sections.reviews.enabled && layout.sectionsOrder.includes('reviews')"
        id="reviews"
      />
    </template>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData, useAsyncData, useRequestFetch, useRoute } from 'nuxt/app'
import type { Banner, Gallery, Tenant } from '@fastio/shared'
import { defaultSiteContent, defaultSiteLayout, deepMerge } from '@fastio/shared'
import PageShell from '~/components/sections/PageShell.vue'
import HeroSection from '~/components/sections/HeroSection.vue'
import BannersSection from '~/components/sections/BannersSection.vue'
import MenuSection from '~/components/sections/MenuSection.vue'
import GallerySection from '~/components/sections/GallerySection.vue'
import ReviewsSection from '~/components/sections/ReviewsSection.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const rfetch = useRequestFetch()
const route = useRoute()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}
await Promise.all([
  useAsyncData('banners', () => rfetch<Banner[]>('/api/banners', slugQuery)),
  useAsyncData('galleries', () => rfetch<Gallery[]>('/api/galleries', slugQuery)),
])

const { data: banners } = useNuxtData<Banner[]>('banners')
const { data: galleries } = useNuxtData<Gallery[]>('galleries')

type SiteContentType = ReturnType<typeof defaultSiteContent>

const content = computed(() =>
  deepMerge(defaultSiteContent(), (tenant.value?.siteContent ?? {}) as Partial<SiteContentType>)
)

type SiteLayoutType = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayoutType>)
)

const menuDefaultView = computed(() => layout.value.sections.menu.defaultView)
</script>
