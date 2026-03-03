<template>
  <div class="settings-root">
    <UiAppEmpty v-if="!tenantStore.tenant && !tenantStore.loading" text="Заведение не найдено. Обратитесь в поддержку." />

    <template v-else-if="tenantStore.tenant">
      <UiTabs v-model="activeTab" :tabs="settingsTabs" />

      <div class="section">
        <SettingsContacts
          v-if="activeTab === 'contacts'"
          :tenant="tenantStore.tenant"
          @save="tenantStore.update"
        />
        <SettingsHours
          v-else-if="activeTab === 'hours'"
          :tenant="tenantStore.tenant"
          @save="tenantStore.update"
        />
        <SettingsTheme
          v-else-if="activeTab === 'theme'"
          :tenant="tenantStore.tenant"
          @save="tenantStore.update"
        />
        <SettingsDelivery
          v-else-if="activeTab === 'delivery'"
          :tenant="tenantStore.tenant"
          @save="tenantStore.update"
        />
        <SettingsNotifications
          v-else-if="activeTab === 'notifications'"
          :tenant="tenantStore.tenant"
          @save="tenantStore.update"
        />
        <SettingsTeam
          v-else-if="activeTab === 'team'"
        />
      </div>
    </template>

    <div v-else class="state-msg">Загрузка…</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { definePageMeta } from '#imports'
import { UiTabs } from '@fastio/ui'
import UiAppEmpty from '~/components/ui/AppEmpty.vue'
import SettingsContacts from '~/components/settings/SettingsContacts.vue'
import SettingsHours from '~/components/settings/SettingsHours.vue'
import SettingsTheme from '~/components/settings/SettingsTheme.vue'
import SettingsDelivery from '~/components/settings/SettingsDelivery.vue'
import SettingsNotifications from '~/components/settings/SettingsNotifications.vue'
import SettingsTeam from '~/components/settings/SettingsTeam.vue'
import { usePermissions } from '~/composables/usePermissions'
import { useTenantStore } from '~/stores/tenant'

definePageMeta({ middleware: 'auth' })

const tenantStore = useTenantStore()
const { canManageTeam } = usePermissions()

onMounted(() => tenantStore.init())

const activeTab = ref('contacts')

const settingsTabs = computed(() => [
  { value: 'contacts', label: 'Контакты', icon: 'mapPin' as const },
  { value: 'hours', label: 'Часы работы', icon: 'clock' as const },
  { value: 'theme', label: 'Оформление', icon: 'palette' as const },
  { value: 'delivery', label: 'Доставка', icon: 'bike' as const },
  { value: 'notifications', label: 'Уведомления', icon: 'messageCircle' as const },
  ...(canManageTeam.value ? [{ value: 'team', label: 'Команда', icon: 'users' as const }] : []),
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
  max-width: 640px;
  overflow: visible;
}
</style>
