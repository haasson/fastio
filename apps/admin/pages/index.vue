<template>
  <ServicesDashboard v-if="tenantStore.isServices" />
  <RetailDashboard v-else-if="tenantStore.isRetail" />
</template>

<script setup lang="ts">
import { useTenantStore } from '~/shared/stores/tenant'
import { usePageTitle } from '~/composables/usePageTitle'
import RetailDashboard from '~/components/retail/dashboard/RetailDashboard.vue'
import ServicesDashboard from '~/features/services-catalog/components/dashboard/ServicesDashboard.vue'

usePageTitle('Дашборд')

const tenantStore = useTenantStore()
</script>
