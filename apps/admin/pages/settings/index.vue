<template>
  <div class="settings-root">
    <UiAppEmpty v-if="!tenantStore.tenant && !tenantStore.loading" text="Заведение не найдено. Обратитесь в поддержку." />

    <template v-else-if="tenantStore.tenant">
      <UiTabs v-model="activeTab" :tabs="settingsTabs" />

      <div class="section">
        <SettingsContacts
          v-if="activeTab === 'contacts'"
          :tenant="tenantStore.tenant"
        />
        <SettingsTheme
          v-else-if="activeTab === 'theme'"
          :tenant="tenantStore.tenant"
          @save="tenantStore.update"
        />
        <SettingsDelivery
          v-else-if="activeTab === 'delivery'"
          :tenant="tenantStore.tenant"
        />
        <SettingsNotifications
          v-else-if="activeTab === 'notifications'"
          :tenant="tenantStore.tenant"
          @save="tenantStore.update"
        />
        <SettingsTeam
          v-else-if="activeTab === 'team'"
        />
        <SettingsBranches
          v-else-if="activeTab === 'branches'"
        />
      </div>
    </template>

    <div v-else class="state-msg">Загрузка…</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { definePageMeta, useRoute, useRouter } from '#imports'
import { UiTabs } from '@fastio/ui'
import UiAppEmpty from '~/components/ui/AppEmpty.vue'
import SettingsContacts from '~/components/settings/SettingsContacts.vue'
import SettingsTheme from '~/components/settings/SettingsTheme.vue'
import SettingsDelivery from '~/components/settings/SettingsDelivery.vue'
import SettingsNotifications from '~/components/settings/SettingsNotifications.vue'
import SettingsTeam from '~/components/settings/SettingsTeam.vue'
import SettingsBranches from '~/components/settings/SettingsBranches.vue'
import { usePermissions } from '~/composables/usePermissions'
import { useTenantStore } from '~/stores/tenant'

definePageMeta({ middleware: 'auth' })

const tenantStore = useTenantStore()
const { canManageTeam } = usePermissions()

onMounted(() => tenantStore.init())

const route = useRoute()
const router = useRouter()

const VALID_TABS = ['contacts', 'theme', 'delivery', 'notifications', 'team', 'branches']

const activeTab = computed({
  get: () => {
    const hash = route.hash.replace('#', '')

    return VALID_TABS.includes(hash) ? hash : 'contacts'
  },
  set: (tab: string) => router.replace({ hash: `#${tab}` }),
})

const settingsTabs = computed(() => [
  { value: 'contacts', label: 'Контакты', icon: 'mapPin' as const },
  { value: 'theme', label: 'Оформление', icon: 'palette' as const },
  { value: 'delivery', label: 'Доставка', icon: 'bike' as const },
  { value: 'notifications', label: 'Уведомления', icon: 'messageCircle' as const },
  ...(canManageTeam.value ? [{ value: 'team', label: 'Команда', icon: 'users' as const }] : []),
  ...(canManageTeam.value ? [{ value: 'branches', label: 'Филиалы', icon: 'mapPin' as const }] : []),
])
</script>

<style scoped lang="scss">
.settings-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  background: var(--color-bg-card);
  border-radius: 14px;
  padding: 28px;
  overflow: visible;
}
</style>
