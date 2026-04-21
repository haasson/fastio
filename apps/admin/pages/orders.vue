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
import { usePageTitle } from '~/composables/usePageTitle'
import { useModules } from '~/composables/plan/useModules'
import { usePermissions } from '~/composables/auth/usePermissions'
import type { IconName } from '@fastio/icons'
import TabsLayout from '~/components/ui/TabsLayout.vue'

usePageTitle('Заказы')

const modules = useModules()
const { canManageTeam } = usePermissions()

type Tab = { value: string; label: string; icon?: IconName; attrs?: Record<string, string> }

const tabs = computed(() => {
  const result: Tab[] = [
    { value: 'orders', label: 'Заказы', icon: 'orders' },
  ]

  if (canManageTeam.value) result.push({ value: 'statuses', label: 'Статусы', icon: 'list', attrs: { 'data-tour': 'orders-tab-statuses' } })
  if (modules.delivery.value.active) result.push({ value: 'delivery', label: 'Доставка', icon: 'bike', attrs: { 'data-tour': 'orders-tab-delivery' } })
  if (canManageTeam.value) result.push({ value: 'order-number', label: 'Нумерация', icon: 'hash', attrs: { 'data-tour': 'orders-tab-number' } })
  if (canManageTeam.value && (modules.delivery.value.active || modules.pickup.value.active))
    result.push({ value: 'settings', label: 'Настройки', icon: 'calendar', attrs: { 'data-tour': 'orders-tab-settings' } })

  return result
})
</script>
