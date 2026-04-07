<template>
  <TabsLayout :tabs="tabs" base-path="/content" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Контент сайта')

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const tabs = [
  { value: 'banners', label: 'Баннеры' },
  { value: 'gallery', label: 'Галерея' },
  { value: 'reviews', label: 'Отзывы' },
  // TODO: vacancies tab — скрыто до реализации функционала
  // { value: 'vacancies', label: 'Вакансии' },
]
</script>
