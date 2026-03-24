<template>
  <UiCard size="large">
    <NuxtPage />
  </UiCard>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { UiCard } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())
</script>
