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

// // TODO: вынести в конфиги. И желательно иметь копию палитры в js, как в css. Тогда переменные будут синхронны и можно их тут юзать
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#ff6b35',
    primaryColorHover: '#ff8a4a',
    primaryColorPressed: '#e55a25',
    primaryColorSuppl: '#ff8a4a',
  },
}
</script>
