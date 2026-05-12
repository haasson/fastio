<template>
  <PageShell show-category-bar>
    <template #default>
      <ServicesSection
        v-if="useServicesCatalog"
        :mobile-service-card="layout.pageSettings.menu.mobileDishCard"
      />
      <MenuSection
        v-else
        default-view="dishes"
        :dish-description-mode="layout.pageSettings.menu.dishDescriptionMode"
        :mobile-dish-card="layout.pageSettings.menu.mobileDishCard"
      />
    </template>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNuxtData } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { defaultSiteLayout, deepMerge } from '@fastio/shared'
import PageShell from '~/shared/ui/sections/PageShell.vue'
import MenuSection from '~/features/menu-catalog/components/MenuSection.vue'
import ServicesSection from '~/features/services-catalog/components/ServicesSection.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

type SiteLayout = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayout>)
)

const useServicesCatalog = computed(() =>
  tenant.value?.businessType === 'services' && tenant.value?.modules?.services === true,
)

</script>
