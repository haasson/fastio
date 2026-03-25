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
import { onMounted } from 'vue'
import { useTenantStore } from '~/stores/tenant'
import TabsLayout from '~/components/ui/TabsLayout.vue'

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const tabs = [
  { value: 'contacts', label: 'Общее', icon: 'settings' as const },
  { value: 'modules', label: 'Модули', icon: 'puzzle' as const },
  { value: 'notifications', label: 'Уведомления', icon: 'messageCircle' as const },
]
</script>

<style scoped lang="scss">
.state-msg {
  color: var(--color-text-secondary);
}
</style>
