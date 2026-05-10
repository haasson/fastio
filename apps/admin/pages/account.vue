<template>
  <TabsLayout :tabs="tabs" base-path="/account" card />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGate } from '~/shared/plan/useGate'
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'
import { usePageTitle } from '~/shared/composables/usePageTitle'

usePageTitle('Личный кабинет')

const gate = useGate()

const tabs = computed(() => [
  { value: 'profile', label: 'Профиль', icon: 'users' as const },
  ...(gate.manageBilling.value.enabled ? [{ value: 'billing', label: 'Тариф и баланс', icon: 'creditCard' as const }] : []),
])
</script>
