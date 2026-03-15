<template>
  <div class="settings-root">
    <template v-if="tenantStore.tenant">
      <UiTabs :model-value="activeTab" :tabs="settingsTabs" @update:model-value="goToTab" />

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
import { usePermissions } from '~/composables/auth/usePermissions'
import { usePlanFeatures } from '~/composables/plan/usePlanFeatures'
import { useTenantStore } from '~/stores/tenant'

const tenantStore = useTenantStore()
const { canManageTeam } = usePermissions()
const { canUseDelivery, canUseBranchSettings } = usePlanFeatures()

onMounted(() => tenantStore.init())

const route = useRoute()
const router = useRouter()

const settingsTabs = computed(() => [
  { value: 'contacts', label: 'Контакты', icon: 'mapPin' as const },
  ...(canUseDelivery.value ? [{ value: 'delivery', label: 'Доставка', icon: 'bike' as const }] : []),
  { value: 'notifications', label: 'Уведомления', icon: 'messageCircle' as const },
  ...(canManageTeam.value ? [{ value: 'team', label: 'Команда', icon: 'users' as const }] : []),
  ...(canManageTeam.value && canUseBranchSettings.value ? [{ value: 'branches', label: 'Филиалы', icon: 'mapPin' as const }] : []),
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
