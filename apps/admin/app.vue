<template>
  <UiConfigProvider :theme-overrides="themeOverrides">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UiConfigProvider>
</template>

<script setup lang="ts">
import { UiConfigProvider } from '@fastio/ui'
import type { GlobalThemeOverrides } from 'naive-ui'

const adminPalette = {
  orange500: '#ff6b35',
  orange400: '#ff8a4a',
  orange600: '#e55a25',
} as const

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: adminPalette.orange500,
    primaryColorHover: adminPalette.orange400,
    primaryColorPressed: adminPalette.orange600,
    primaryColorSuppl: adminPalette.orange400,
  },
}
</script>
