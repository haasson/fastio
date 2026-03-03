<template>
  <NConfigProvider>
    <NuxtPage />
  </NConfigProvider>
</template>

<script setup lang="ts">
import { NConfigProvider } from 'naive-ui'

useHead({ link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }] })
</script>
