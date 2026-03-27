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
import type { IconName } from '@fastio/icons'
import TabsLayout from '~/components/ui/TabsLayout.vue'

const modules = useModules()
const { canManageTeam } = usePermissions()

type Tab = { value: string; label: string; icon?: IconName }

const tabs = computed(() => {
  const result: Tab[] = [
    { value: 'orders', label: 'Заказы', icon: 'orders' },
  ]

  if (canManageTeam.value) result.push({ value: 'statuses', label: 'Статусы', icon: 'list' })
  if (modules.delivery.value.active) result.push({ value: 'delivery', label: 'Доставка', icon: 'bike' })
  if (canManageTeam.value) result.push({ value: 'order-number', label: 'Нумерация', icon: 'hash' })

  return result
})
</script>
