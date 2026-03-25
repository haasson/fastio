<template>
  <TabsLayout :tabs="tabs" base-path="/content" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import TabsLayout from '~/components/ui/TabsLayout.vue'

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const tabs = [
  { value: 'banners', label: 'Баннеры' },
  { value: 'gallery', label: 'Галерея' },
  { value: 'reviews', label: 'Отзывы' },
  { value: 'vacancies', label: 'Вакансии' },
]
</script>
