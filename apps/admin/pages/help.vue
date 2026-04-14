<template>
  <TabsLayout
    :tabs="tabs"
    base-path="/help"
    full-height
  />
</template>

<script setup lang="ts">
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Помощь')

const tabs = [
  { value: 'tours', label: 'Виртуальные туры' },
  { value: 'support', label: 'Поддержка' },
]
</script>
