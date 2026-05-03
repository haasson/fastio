<template>
  <TabsLayout :tabs="tabs" base-path="/services" />
</template>

<script setup lang="ts">
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Услуги')

const tabs = [
  { value: 'items', label: 'Услуги' },
  { value: 'categories', label: 'Категории' },
  { value: 'tags', label: 'Теги' },
  { value: 'settings', label: 'Настройки' },
]
</script>
