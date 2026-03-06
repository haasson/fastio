<template>
  <n-config-provider
    :locale="ruRU"
    :date-locale="dateRuRU"
    :theme="isDark ? darkTheme : undefined"
    :theme-overrides="isDark ? darkThemeOverrides : lightThemeOverrides"
  >
    <n-message-provider>
      <slot />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, NMessageProvider, darkTheme, ruRU, dateRuRU } from 'naive-ui'
import { lightThemeOverrides, darkThemeOverrides } from '../config/naive-ui-theme-overrides'

type Props = {
  isDark?: boolean
}

defineProps<Props>()
</script>
