<template>
  <PageShell show-category-bar :category-bar-navigate="menuDefaultView === 'categories'">
    <template #default="{ stickyTotalHeight, layout: shellLayout }">
      <template v-for="key in shellLayout.sectionsOrder" :key="key">
        <HeroSection
          v-if="key === 'hero' && shellLayout.sections.hero.enabled"
          id="hero"
          :hero="shellLayout.sections.hero"
          :hero-content="content.hero"
          :sticky-height="stickyTotalHeight"
        />
        <BannersSection
          v-else-if="key === 'banners' && shellLayout.sections.banners.enabled"
          id="banners"
          :banners="banners ?? []"
          :settings="shellLayout.sections.banners"
        />
        <ServicesSection
          v-else-if="key === 'menu' && shellLayout.sections.menu.enabled && useServicesCatalog"
          id="menu"
          :default-view="menuDefaultView"
          :mobile-service-card="shellLayout.sections.menu.mobileDishCard"
        />
        <MenuSection
          v-else-if="key === 'menu' && shellLayout.sections.menu.enabled"
          id="menu"
          :default-view="menuDefaultView"
          :dish-description-mode="shellLayout.sections.menu.dishDescriptionMode"
          :mobile-dish-card="shellLayout.sections.menu.mobileDishCard"
        />
        <GallerySection
          v-else-if="key === 'gallery' && shellLayout.sections.gallery.enabled && shellLayout.sections.gallery.galleryIds?.length"
          id="gallery"
          :galleries="galleries ?? []"
          :gallery-ids="shellLayout.sections.gallery.galleryIds ?? []"
        />
        <ReviewsSection
          v-else-if="key === 'reviews' && shellLayout.sections.reviews.enabled"
          id="reviews"
        />
      </template>
    </template>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData, useAsyncData, useRequestFetch, useRoute } from 'nuxt/app'
import type { Banner, Gallery, Tenant } from '@fastio/shared'
import { defaultSiteContent, defaultSiteLayout, deepMerge } from '@fastio/shared'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import HeroSection from '~/shared/ui/sections/HeroSection.vue'
import BannersSection from '~/shared/ui/sections/BannersSection.vue'
import MenuSection from '~/features/menu-catalog/components/MenuSection.vue'
import ServicesSection from '~/features/services-catalog/components/ServicesSection.vue'
import GallerySection from '~/shared/ui/sections/GallerySection.vue'
import ReviewsSection from '~/shared/ui/sections/ReviewsSection.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const useServicesCatalog = computed(() =>
  tenant.value?.businessType === 'services' && tenant.value?.modules?.services === true,
)

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
