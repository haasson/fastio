<template>
  <PageShell show-category-bar>
    <template #default="{ stickyTotalHeight, layout }">
      <HeroSection
        v-if="layout.sections.hero.enabled && layout.sectionsOrder.includes('hero')"
        :hero="layout.sections.hero"
        :hero-content="content.hero"
        :sticky-height="stickyTotalHeight"
      />
      <BannersSection
        v-if="layout.sections.banners.enabled && layout.sectionsOrder.includes('banners')"
        :banners="content.banners"
        :settings="layout.sections.banners"
      />
      <MenuSection
        v-if="layout.sections.menu.enabled && layout.sectionsOrder.includes('menu')"
        :default-view="layout.sections.menu.defaultView"
      />
      <GallerySection v-if="layout.sections.gallery.enabled && layout.sectionsOrder.includes('gallery')" />
      <ReviewsSection v-if="layout.sections.reviews.enabled && layout.sectionsOrder.includes('reviews')" />
    </template>

    <template #fab>
      <SfCartFab @click="navigateTo('/cart')" />
    </template>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData, useAsyncData, useRequestFetch, useRoute, navigateTo } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { defaultSiteContent, deepMerge } from '@fastio/shared'
import PageShell from '~/components/sections/PageShell.vue'
import HeroSection from '~/components/sections/HeroSection.vue'
import BannersSection from '~/components/sections/BannersSection.vue'
import MenuSection from '~/components/sections/MenuSection.vue'
import GallerySection from '~/components/sections/GallerySection.vue'
import ReviewsSection from '~/components/sections/ReviewsSection.vue'
import SfCartFab from '~/components/sf/domain/SfCartFab.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const rfetch = useRequestFetch()
const route = useRoute()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}
await useAsyncData('menu', () => rfetch('/api/menu', slugQuery))

type SiteContentType = ReturnType<typeof defaultSiteContent>

const content = computed(() =>
  deepMerge(defaultSiteContent(), (tenant.value?.siteContent ?? {}) as Partial<SiteContentType>)
)
</script>
