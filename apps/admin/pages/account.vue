<template>
  <TabsLayout :tabs="tabs" base-path="/account" card />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGate } from '~/composables/plan/useGate'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Личный кабинет')

const gate = useGate()

const tabs = computed(() => [
  { value: 'profile', label: 'Профиль', icon: 'users' as const },
  ...(gate.manageBilling.value.enabled ? [{ value: 'billing', label: 'Тариф и баланс', icon: 'creditCard' as const }] : []),
])
</script>
