<template>
  <div class="appointments-root" @click="resetCount">
    <TabsLayout :tabs="tabs" base-path="/appointments" />
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useNewAppointmentCounter } from '~/composables/data/useNewAppointmentCounter'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'
import { useRoute, navigateTo } from '#imports'
import { useTenantStore } from '~/stores/tenant'
import { useAppointmentSettingsStore } from '~/stores/appointmentSettings'

usePageTitle('Запись')

const { reset: resetCount } = useNewAppointmentCounter()

resetCount()

const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)
const settingsStore = useAppointmentSettingsStore()
const { resourceMode } = storeToRefs(settingsStore)

watch(currentTenantId, () => settingsStore.load(), { immediate: true })

const tabs = computed(() => {
  const items: { value: string; label: string }[] = [
    { value: 'timeline', label: 'Расписание' },
    { value: 'history', label: 'История' },
  ]

  if (resourceMode.value !== 'objects') items.push({ value: 'staff', label: 'Сотрудники' })
  if (resourceMode.value !== 'staff') items.push({ value: 'objects', label: 'Объекты' })
  items.push(
    { value: 'templates', label: 'Графики работы' },
    { value: 'settings', label: 'Настройки' },
  )

  return items
})

const route = useRoute()

if (route.path === '/appointments') {
  await navigateTo('/appointments/timeline', { replace: true })
}
</script>

<style scoped lang="scss">
.appointments-root {
  display: contents;
}
</style>
