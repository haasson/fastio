<template>
  <TabsLayout :tabs="tabs" base-path="/services" />
</template>

<script setup lang="ts">
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'
import { useRoute, navigateTo } from '#imports'

usePageTitle('Услуги')

const tabs = [
  { value: 'items', label: 'Услуги' },
  { value: 'categories', label: 'Категории' },
  { value: 'tags', label: 'Теги' },
]

const route = useRoute()

if (route.path === '/services') {
  await navigateTo('/services/items', { replace: true })
}
</script>
