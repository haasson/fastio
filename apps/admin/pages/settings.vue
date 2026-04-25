<template>
  <TabsLayout
    :tabs="tabs"
    base-path="/settings"
    hide-single
  />
</template>

<script setup lang="ts">
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Настройки')

const tabs = [
  { value: 'contacts', label: 'Общее', icon: 'settings' as const },
  { value: 'modules', label: 'Модули', icon: 'puzzle' as const },
  { value: 'notifications', label: 'Уведомления', icon: 'messageCircle' as const },
  { value: 'legal', label: 'Юридические', icon: 'fileText' as const },
]
</script>
