<template>
  <PageShell show-category-bar category-bar-navigate>
    <template #default>
      <ServicesSection
        v-if="useServicesCatalog && categoryId"
        :category-id="categoryId"
        :mobile-service-card="layout.sections.menu.mobileDishCard"
      />
      <MenuSection
        v-else-if="categoryId"
        default-view="dishes"
        :category-id="categoryId"
        :dish-description-mode="layout.sections.menu.dishDescriptionMode"
        :mobile-dish-card="layout.sections.menu.mobileDishCard"
      />
    </template>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, navigateTo, useNuxtData } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { defaultSiteLayout, deepMerge } from '@fastio/shared'
import { useCatalogMode } from '~/shared/composables/useCatalogMode'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import MenuSection from '~/features/menu-catalog/components/MenuSection.vue'
import ServicesSection from '~/features/services-catalog/components/ServicesSection.vue'

const route = useRoute()
const { isServicesMode, visibleCategories } = useCatalogMode()
const { data: tenant } = useNuxtData<Tenant>('tenant')

type SiteLayout = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayout>)
)

const useServicesCatalog = isServicesMode

const slug = computed(() => route.params.slug as string)

const category = computed(() =>
  visibleCategories.value.find(c => (c.slug ?? c.id) === slug.value) ?? null
)

const categoryId = computed(() => category.value?.id ?? null)

if (!categoryId.value) {
  await navigateTo('/', { replace: true })
}

useHead(computed(() => ({
  title: category.value?.name ?? '',
})))
</script>
