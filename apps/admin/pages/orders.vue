<template>
  <TabsLayout
    :tabs="tabs"
    base-path="/orders"
    root-tab="orders"
    hide-single
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useModules } from '~/composables/plan/useModules'
import { usePermissions } from '~/composables/auth/usePermissions'
import TabsLayout from '~/components/ui/TabsLayout.vue'

const modules = useModules()
const { canManageTeam } = usePermissions()

const tabs = computed(() => [
  { value: 'orders', label: 'Заказы', icon: 'orders' as const },
  ...(modules.delivery.value.active ? [{ value: 'delivery', label: 'Доставка', icon: 'bike' as const }] : []),
  ...(canManageTeam.value ? [{ value: 'order-number', label: 'Нумерация', icon: 'hash' as const }] : []),
])
</script>
