<template>
  <TabsLayout
    :tabs="tabs"
    base-path="/settings"
    hide-single
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'
import { useGate } from '~/composables/plan/useGate'

usePageTitle('Настройки')

const gate = useGate()

const hasIntake = computed(() => gate.orders.value.enabled || gate.reservations.value.enabled || gate.dineIn.value.enabled)

const tabs = computed(() => [
  { value: 'contacts', label: 'Общее', icon: 'settings' as const },
  { value: 'modules', label: 'Модули', icon: 'puzzle' as const },
  ...(hasIntake.value
    ? [
        { value: 'notifications', label: 'Уведомления', icon: 'messageCircle' as const },
        { value: 'legal', label: 'Юридические', icon: 'fileText' as const },
      ]
    : []),
])
</script>
