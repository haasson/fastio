<template>
  <TabsLayout
    :tabs="tabs"
    base-path="/settings"
    hide-single
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'
import { usePageTitle } from '~/shared/composables/usePageTitle'
import { useGate } from '~/shared/plan/useGate'

usePageTitle('Настройки')

const gate = useGate()

// Уведомления и Юридические нужны при ЛЮБОМ канале приёма клиентских данных:
// доставка, самовывоз, посадка, бронь столов, запись на услуги. Уведомления —
// telegram/email тенанту и клиенту по новой записи/заказу. Юридические —
// согласие на обработку ПД на витрине (без них submit блокируется).
// gate.orders уже = delivery || pickup, поэтому отдельные флаги не нужны.
const hasIntake = computed(() => gate.orders.value.enabled
  || gate.reservations.value.enabled
  || gate.dineIn.value.enabled
  || gate.services.value.enabled,
)

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
