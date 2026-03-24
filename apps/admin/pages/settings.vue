<template>
  <div class="settings-root">
    <template v-if="tenantStore.tenant">
      <UiTabs
        v-if="settingsTabs.length > 1"
        :model-value="activeTab"
        :tabs="settingsTabs"
        @update:model-value="goToTab"
      />

      <UiCard size="large">
        <NuxtPage :tenant="tenantStore.tenant" @save="tenantStore.update" />
      </UiCard>
    </template>

    <div v-else class="state-msg">Загрузка…</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiTabs, UiCard } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'

const tenantStore = useTenantStore()

onMounted(() => tenantStore.init())

const route = useRoute()
const router = useRouter()

const settingsTabs = computed(() => [
  { value: 'contacts', label: 'Общее', icon: 'settings' as const },
  { value: 'modules', label: 'Модули', icon: 'puzzle' as const },
  { value: 'notifications', label: 'Уведомления', icon: 'messageCircle' as const },
])

const activeTab = computed(() => {
  const seg = route.path.split('/').at(-1) ?? ''
  const validValues = settingsTabs.value.map((t) => t.value)

  return validValues.includes(seg) ? seg : 'contacts'
})

const goToTab = (tab: string | number) => {
  router.push(`/settings/${tab}`)
}
</script>

<style scoped lang="scss">
.settings-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
