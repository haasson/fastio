<template>
  <PageShell show-category-bar category-bar-navigate>
    <template #default>
      <MenuSection
        v-if="categoryId"
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
import { useMenuStore } from '~/stores/menu'
import PageShell from '~/components/sections/PageShell.vue'
import MenuSection from '~/components/sections/MenuSection.vue'

const route = useRoute()
const menuStore = useMenuStore()
const { data: tenant } = useNuxtData<Tenant>('tenant')

type SiteLayout = ReturnType<typeof defaultSiteLayout>

const layout = computed(() =>
  deepMerge(defaultSiteLayout(), (tenant.value?.siteLayout ?? {}) as Partial<SiteLayout>)
)

const slug = computed(() => route.params.slug as string)

const category = computed(() =>
  menuStore.visibleCategories.find(c => (c.slug ?? c.id) === slug.value) ?? null
)

const categoryId = computed(() => category.value?.id ?? null)

if (!categoryId.value) {
  await navigateTo('/', { replace: true })
}

useHead(computed(() => ({
  title: category.value?.name ?? '',
})))
</script>
