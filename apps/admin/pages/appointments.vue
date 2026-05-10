<template>
  <div class="appointments-root">
    <TabsLayout :tabs="tabs" base-path="/appointments" />
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'
import { useTenantStore } from '~/stores/tenant'
import { useAppointmentSettingsStore } from '~/features/appointments'

usePageTitle('Запись')

const tenantStore = useTenantStore()
const { currentTenantId } = storeToRefs(tenantStore)
const settingsStore = useAppointmentSettingsStore()
const { resourceMode } = storeToRefs(settingsStore)

watch(currentTenantId, () => settingsStore.load(), { immediate: true })

const tabs = computed(() => {
  const items: { value: string; label: string }[] = [
    { value: 'list', label: 'Записи' },
    { value: 'timeline', label: 'Расписание' },
  ]

  if (resourceMode.value !== 'objects') items.push({ value: 'staff', label: 'Сотрудники' })
  if (resourceMode.value !== 'staff') items.push({ value: 'objects', label: 'Объекты' })
  items.push(
    { value: 'templates', label: 'Графики работы' },
    { value: 'settings', label: 'Настройки' },
  )

  return items
})
</script>

<style scoped lang="scss">
.appointments-root {
  display: contents;
}
</style>
