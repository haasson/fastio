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
import { usePageTitle } from '~/shared/composables/usePageTitle'
import { useGate } from '~/shared/plan/useGate'
import type { IconName } from '@fastio/icons'
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'

usePageTitle('Заказы')

const gate = useGate()

type Tab = { value: string; label: string; icon?: IconName; attrs?: Record<string, string> }

const tabs = computed(() => {
  const result: Tab[] = [
    { value: 'orders', label: 'Заказы', icon: 'orders' },
  ]

  if (gate.editSettings.value.enabled) result.push({ value: 'statuses', label: 'Статусы', icon: 'list', attrs: { 'data-tour': 'orders-tab-statuses' } })
  if (gate.delivery.value.enabled) result.push({ value: 'delivery', label: 'Доставка', icon: 'bike', attrs: { 'data-tour': 'orders-tab-delivery' } })
  if (gate.editSettings.value.enabled) result.push({ value: 'order-number', label: 'Нумерация', icon: 'hash', attrs: { 'data-tour': 'orders-tab-number' } })
  if (gate.editSettings.value.enabled && gate.orders.value.enabled)
    result.push({ value: 'settings', label: 'Настройки', icon: 'calendar', attrs: { 'data-tour': 'orders-tab-settings' } })

  return result
})
</script>
