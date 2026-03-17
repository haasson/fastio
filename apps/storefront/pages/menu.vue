<template>
  <PageShell show-category-bar>
    <template #default="{ layout }">
      <MenuSection :default-view="layout.sections.menu.defaultView" />
    </template>

    <template #fab>
      <SfCartFab @click="navigateTo('/cart')" />
    </template>
  </PageShell>
</template>

<script setup lang="ts">
import { useAsyncData, useRequestFetch, useRoute, navigateTo } from 'nuxt/app'
import PageShell from '~/components/sections/PageShell.vue'
import MenuSection from '~/components/sections/MenuSection.vue'
import SfCartFab from '~/components/sf/domain/SfCartFab.vue'

const rfetch = useRequestFetch()
const route = useRoute()
const slugQuery = route.query.slug ? { query: { slug: route.query.slug } } : {}
await useAsyncData('menu', () => rfetch('/api/menu', slugQuery))
</script>
