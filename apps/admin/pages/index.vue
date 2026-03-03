<template>
  <div class="dashboard-root">
    <UiTitle size="h4" class="heading">Дашборд</UiTitle>
  </div>
</template>

<script setup lang="ts">
import { definePageMeta } from '#imports'
import { UiTitle } from '@fastio/ui'

definePageMeta({ middleware: 'auth' })
</script>

<style scoped lang="scss">
.heading {
  margin-bottom: 24px;
}
</style>
