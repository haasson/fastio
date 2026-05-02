<template>
  <NuxtPage />
</template>

<script setup lang="ts">
import { useRuntimeConfig, useHead } from '#imports'

const { siteUrl } = useRuntimeConfig().public
const url = `${siteUrl}/`

useHead({
  link: [{ rel: 'canonical', href: url }],
  meta: [{ property: 'og:url', content: url }],
})
</script>
