<template>
  <PageShell :show-category-bar="menuDefaultView === 'dishes'">
    <template #default>
      <MenuSection :default-view="menuDefaultView" />
    </template>

    <template #fab>
      <SfCartFab @click="navigateTo('/cart')" />
    </template>
  </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAsyncData, useNuxtData, useRequestFetch, useRoute, navigateTo } from 'nuxt/app'
import type { Tenant } from '@fastio/shared'
import { defaultSiteLayout, deepMerge } from '@fastio/shared'
import PageShell from '~/components/sections/PageShell.vue'
import MenuSection from '~/components/sections/MenuSection.vue'
import SfCartFab from '~/components/sf/domain/SfCartFab.vue'

const { data: tenant } = useNuxtData<Tenant>('tenant')

type SiteLayout = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayout>)
)

const menuDefaultView = computed(() => layout.value.pageSettings.menu.defaultView)

const rfetch = useRequestFetch()
const route = useRoute()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}
await useAsyncData('menu', () => rfetch('/api/menu', slugQuery))
</script>
