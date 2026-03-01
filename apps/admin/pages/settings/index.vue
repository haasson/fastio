<template>
  <div class="settings-root">
    <div v-if="!tenantStore.tenant && !tenantStore.loading" class="state-msg">
      Заведение не найдено. Обратитесь в поддержку.
    </div>

    <template v-else-if="tenantStore.tenant">
      <!-- Табы -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="tab"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </div>

      <!-- Секции -->
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
      </div>
    </template>

    <div v-else class="state-msg">Загрузка…</div>
  </div>
</template>

<script setup lang="ts">
import { useTenantStore } from '~/stores/tenant'

definePageMeta({ middleware: 'auth' })

const tenantStore = useTenantStore()
onMounted(() => tenantStore.init())

const activeTab = ref('contacts')

const tabs = [
  { value: 'contacts', icon: '📍', label: 'Контакты' },
  { value: 'hours', icon: '🕐', label: 'Часы работы' },
  { value: 'theme', icon: '🎨', label: 'Оформление' },
  { value: 'delivery', icon: '🚴', label: 'Доставка' },
  { value: 'notifications', icon: '🔔', label: 'Уведомления' },
]
</script>

<style scoped>
.settings-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tabs {
  display: flex;
  gap: 4px;
  background: #fff;
  border-radius: 12px;
  padding: 6px;
  width: fit-content;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  flex-wrap: wrap;
}

.tab {
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: #888;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab:hover {
  background: #f5f5f5;
  color: #333;
}

.tab.active {
  background: #ff6b35;
  color: #fff;
}

.tab-icon {
  font-size: 15px;
}

.section {
  background: #fff;
  border-radius: 14px;
  padding: 28px;
  max-width: 640px;
}

.state-msg {
  color: #aaa;
  padding: 40px;
  text-align: center;
}
</style>
