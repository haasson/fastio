<template>
  <div class="settings-root">
<!--    // TODO: вот этот блок на каждой странице непонятен. Если заведения нет - куда мы вообще залогинились?  -->
    <div v-if="!tenantStore.tenant && !tenantStore.loading" class="state-msg">
      Заведение не найдено. Обратитесь в поддержку.
    </div>

    <template v-else-if="tenantStore.tenant">
<!--   // TODO: у табов страшные иконки, нужно во всем проекте иконки заменить на монохромные стильные аналоги   -->
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
import { UiTabs } from '@fastio/ui'
import { useTenantStore } from '~/stores/tenant'

definePageMeta({ middleware: 'auth' })

const tenantStore = useTenantStore()
const { canManageTeam } = usePermissions()
onMounted(() => tenantStore.init())

const activeTab = ref('contacts')

const settingsTabs = computed(() => [
  { value: 'contacts', label: '📍 Контакты' },
  { value: 'hours', label: '🕐 Часы работы' },
  { value: 'theme', label: '🎨 Оформление' },
  { value: 'delivery', label: '🚴 Доставка' },
  { value: 'notifications', label: '🔔 Уведомления' },
  ...(canManageTeam.value ? [{ value: 'team', label: '👥 Команда' }] : []),
])
</script>

<style scoped lang="scss">
.settings-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section {
  background: #fff;
  border-radius: 14px;
  padding: 28px;
  max-width: 640px;
  overflow: visible;
}

.state-msg {
  color: #aaa;
  padding: 40px;
  text-align: center;
}
</style>
