<template>
  <div v-if="tenantStore.hasMultipleTenants" class="switcher-root">
    <button class="trigger" @click="open = !open">
      <span class="name">{{ currentName }}</span>
      <UiIcon name="chevronRound" :size="14" :rotate="open ? 180 : 0" />
    </button>

    <div v-if="open" class="dropdown">
      <button
        v-for="m in tenantStore.memberships"
        :key="m.tenantId"
        class="option"
        :class="{ active: m.tenantId === tenantStore.currentTenantId }"
        @click="select(m.tenantId)"
      >
        <span class="option-name">{{ m.tenant?.name ?? 'Без названия' }}</span>
        <span class="option-role">{{ roleLabel(m.role) }}</span>
      </button>
    </div>

    <div v-if="open" class="backdrop" @click="open = false" />
  </div>
</template>

<script setup lang="ts">
import { UiIcon } from '@fastio/ui'
import type { TenantRole } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

const tenantStore = useTenantStore()
const open = ref(false)

const currentName = computed(() => {
  const m = tenantStore.memberships.find(m => m.tenantId === tenantStore.currentTenantId)
  return m?.tenant?.name ?? 'Выберите заведение'
})

const roleLabels: Record<TenantRole, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  manager: 'Менеджер',
  staff: 'Сотрудник',
}

function roleLabel(role: TenantRole) {
  return roleLabels[role]
}

function select(tenantId: string) {
  tenantStore.switchTenant(tenantId)
  open.value = false
}
</script>

<style scoped lang="scss">
.switcher-root {
  position: relative;
  padding: 0 10px;
  margin-bottom: 8px;
}

.trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.12);
  }
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 100%;
  margin-top: 4px;
  background: #252540;
  border-radius: 10px;
  padding: 4px;
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  &.active {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
  }
}

.option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-role {
  flex-shrink: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 9;
}
</style>
