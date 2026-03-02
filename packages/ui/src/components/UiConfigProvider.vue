<template>
  <n-config-provider
    :locale="ruRU"
    :date-locale="dateRuRU"
    :theme-overrides="themeOverrides"
  >
    <slot />
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, ruRU, dateRuRU } from 'naive-ui'
import type { GlobalThemeOverrides } from 'naive-ui'

type Props = {
  themeOverrides?: GlobalThemeOverrides
}

defineProps<Props>()
</script>
