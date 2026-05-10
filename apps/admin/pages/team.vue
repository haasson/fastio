<template>
  <TabsLayout
    :tabs="tabs"
    base-path="/team"
    card
    hide-single
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'
import { useGate } from '~/shared/plan/useGate'
import { usePageTitle } from '~/shared/composables/usePageTitle'

usePageTitle('Команда')

const gate = useGate()

const tabs = computed(() => {
  const list = [
    { value: 'members', label: 'Участники' },
  ]

  if (gate.manageRoles.value.enabled && gate.customRoles.value.enabled) {
    list.push({ value: 'roles', label: 'Роли' })
  }

  return list
})

</script>
