<template>
  <PageShell>
    <FsSection>
    <StorePageLayout :breadcrumbs="[{ label: 'Главная', to: '/' }]" current="Галерея">
      <template v-if="visibleGalleries.length">
        <div class="gallery-page">
          <template v-for="gallery in visibleGalleries" :key="gallery.id">
            <div class="gallery-block">
              <div v-if="gallery.title || gallery.description" class="gallery-header">
                <FsHeading v-if="gallery.title" as="h4">{{ gallery.title }}</FsHeading>
                <p v-if="gallery.description" class="gallery-desc">{{ gallery.description }}</p>
              </div>
              <GallerySlider :gallery="gallery" />
            </div>
          </template>
        </div>
      </template>

      <SfEmptyState
        v-else
        title="Галерея пуста"
        description="Фотографии появятся здесь"
      >
        <Image :size="48" />
      </SfEmptyState>
    </StorePageLayout>
    </FsSection>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Image } from 'lucide-vue-next'
import { useNuxtData, useAsyncData, useRequestFetch, useRoute } from 'nuxt/app'
import type { Gallery, Tenant } from '@fastio/shared'
import { defaultSiteLayout, deepMerge } from '@fastio/shared'
import { FsSection, FsHeading } from '@fastio/public-ui'
import PageShell from '~/components/sections/PageShell.vue'
import StorePageLayout from '~/components/layout/StorePageLayout.vue'
import GallerySlider from '~/components/sections/GallerySlider.vue'
import SfEmptyState from '~/components/sf/domain/SfEmptyState.vue'

const rfetch = useRequestFetch()
const route = useRoute()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}

await useAsyncData('galleries', () => rfetch<Gallery[]>('/api/galleries', slugQuery))

const { data: tenant } = useNuxtData<Tenant>('tenant')
const { data: galleries } = useNuxtData<Gallery[]>('galleries')

type SiteLayoutType = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayoutType>)
)

const galleryIds = computed(() => layout.value.pageSettings.gallery?.galleryIds ?? [])

const visibleGalleries = computed(() =>
  galleryIds.value
    .map((id) => (galleries.value ?? []).find((g) => g.id === id))
    .filter((g): g is Gallery => !!g && g.photos.length > 0),
)
</script>

<style scoped lang="scss">
.gallery-page {
  display: flex;
  flex-direction: column;
  gap: 40px;
  padding-top: 8px;
}

.gallery-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gallery-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gallery-desc {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
</style>
