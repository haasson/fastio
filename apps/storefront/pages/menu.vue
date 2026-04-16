<template>
  <PageShell show-category-bar>
    <template #default>
      <MenuSection
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
import PageShell from '~/components/sections/PageShell.vue'
import MenuSection from '~/components/sections/MenuSection.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

type SiteLayout = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayout>)
)

</script>
