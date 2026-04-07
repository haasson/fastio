<template>
  <TabsLayout :tabs="tabs" base-path="/promotions" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Акции')

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const tabs = [
  { value: 'list', label: 'Акции' },
  { value: 'promo-codes', label: 'Промокоды' },
]
</script>
