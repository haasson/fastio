<template>
  <template v-if="tenantStore.tenant">
    <TabsLayout
      :tabs="tabs"
      base-path="/settings"
      card
      hide-single
    />
  </template>
  <div v-else class="state-msg">Загрузка…</div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Настройки')

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const isServices = computed(() => tenantStore.tenant?.businessType === 'services')

const tabs = computed(() => {
  const all = [
    { value: 'contacts', label: 'Общее', icon: 'settings' as const },
    { value: 'modules', label: 'Модули', icon: 'puzzle' as const },
    { value: 'notifications', label: 'Уведомления', icon: 'messageCircle' as const },
    { value: 'legal', label: 'Юридические', icon: 'fileText' as const },
  ]

  return isServices.value ? all.filter((t) => t.value !== 'modules') : all
})
</script>

<style scoped lang="scss">
.state-msg {
  color: var(--color-text-secondary);
}
</style>
