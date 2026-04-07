<template>
  <TabsLayout
    :tabs="tabs"
    base-path="/help"
    full-height
    prevent-compact
  />
</template>

<script setup lang="ts">
import TabsLayout from '~/components/ui/TabsLayout.vue'

const tabs = [
  { value: 'tours', label: 'Виртуальные туры' },
  { value: 'support', label: 'Поддержка' },
]
</script>
