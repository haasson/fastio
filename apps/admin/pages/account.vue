<template>
  <TabsLayout :tabs="tabs" base-path="/account" card />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePermissions } from '~/composables/auth/usePermissions'
import TabsLayout from '~/components/ui/TabsLayout.vue'

const { canManageBilling } = usePermissions()

const tabs = computed(() => [
  { value: 'profile', label: 'Профиль', icon: 'users' as const },
  ...(canManageBilling.value ? [{ value: 'billing', label: 'Тариф и баланс', icon: 'creditCard' as const }] : []),
])
</script>
