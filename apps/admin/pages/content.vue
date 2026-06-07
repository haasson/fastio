<template>
  <TabsLayout :tabs="tabs" base-path="/content" />
</template>

<script setup lang="ts">
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'
import { usePageTitle } from '~/shared/composables/usePageTitle'

usePageTitle('Контент сайта')

const tabs = [
  { value: 'banners', label: 'Баннеры' },
  { value: 'gallery', label: 'Галерея' },
  // TODO: reviews tab — скрыто до реализации функционала
  // { value: 'reviews', label: 'Отзывы' },
  // TODO: vacancies tab — скрыто до реализации функционала
  // { value: 'vacancies', label: 'Вакансии' },
]
</script>
