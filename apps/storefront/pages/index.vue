<template>
  <PageShell :show-category-bar="menuDefaultView === 'dishes'">
    <template #default="{ stickyTotalHeight, layout: shellLayout }">
      <HeroSection
        v-if="shellLayout.sections.hero.enabled && shellLayout.sectionsOrder.includes('hero')"
        id="hero"
        :hero="shellLayout.sections.hero"
        :hero-content="content.hero"
        :sticky-height="stickyTotalHeight"
      />
      <BannersSection
        v-if="shellLayout.sections.banners.enabled && shellLayout.sectionsOrder.includes('banners')"
        id="banners"
        :banners="banners ?? []"
        :settings="shellLayout.sections.banners"
      />
      <MenuSection
        v-if="shellLayout.sections.menu.enabled && shellLayout.sectionsOrder.includes('menu')"
        id="menu"
        :default-view="menuDefaultView"
        :dish-description-mode="shellLayout.sections.menu.dishDescriptionMode"
        :mobile-dish-card="shellLayout.sections.menu.mobileDishCard"
      />
      <GallerySection
        v-if="shellLayout.sections.gallery.enabled && shellLayout.sectionsOrder.includes('gallery') && shellLayout.sections.gallery.galleryIds?.length"
        id="gallery"
        :galleries="galleries ?? []"
        :gallery-ids="shellLayout.sections.gallery.galleryIds ?? []"
      />
      <ReviewsSection
        v-if="shellLayout.sections.reviews.enabled && shellLayout.sectionsOrder.includes('reviews')"
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
