<template>
  <UiConfigProvider :theme-overrides="themeOverrides">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UiConfigProvider>
</template>

<script setup lang="ts">
import { UiConfigProvider } from '@fastfood-saas/ui'
import type { GlobalThemeOverrides } from 'naive-ui'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#ff6b35',
    primaryColorHover: '#ff8a4a',
    primaryColorPressed: '#e55a25',
    primaryColorSuppl: '#ff8a4a',
  },
}
</script>
