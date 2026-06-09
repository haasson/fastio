<template>
  <TabsLayout :tabs="tabs" base-path="/account" card />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCanManageBilling } from '~/shared/plan/useCanManageBilling'
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'
import { usePageTitle } from '~/shared/composables/usePageTitle'

usePageTitle('Личный кабинет')

const canManageBilling = useCanManageBilling()

const tabs = computed(() => [
  { value: 'profile', label: 'Профиль', icon: 'users' as const },
  ...(canManageBilling.value ? [{ value: 'billing', label: 'Тариф и баланс', icon: 'creditCard' as const }] : []),
])
</script>
