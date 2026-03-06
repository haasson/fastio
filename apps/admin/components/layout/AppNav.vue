<template>
  <nav class="nav" :class="{ 'nav--collapsed': collapsed }">
    <NuxtLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="nav-item"
      active-class="active"
      @click="emit('navigate')"
    >
      <UiIcon :name="item.icon" :size="18" />
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { UiIcon } from '@fastio/ui'
import type { IconName } from '@fastio/ui'
import { usePermissions } from '~/composables/usePermissions'

defineProps<{ collapsed?: boolean }>()

type NavItem = { to: string; icon: IconName; label: string; visible?: ComputedRef<boolean> }

const { canManageMenu, canManageOrders, canManagePromotions, canViewSettings } = usePermissions()

const allNavItems: NavItem[] = [
  { to: '/', icon: 'dashboard', label: 'Дашборд' },
  { to: '/menu', icon: 'dishes', label: 'Меню', visible: canManageMenu },
  { to: '/orders', icon: 'orders', label: 'Заказы', visible: canManageOrders },
  { to: '/promotions', icon: 'promotions', label: 'Акции', visible: canManagePromotions },
  { to: '/settings', icon: 'settings', label: 'Настройки', visible: canViewSettings },
]

const navItems = computed(() => allNavItems.filter((item) => !item.visible || item.visible.value))

const emit = defineEmits<{ navigate: [] }>()

defineExpose({ navItems })
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/media-queries' as *;

.nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--grey-400);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--grey-800);
    color: var(--grey-50);
  }

  &.active {
    background: var(--color-primary);
    color: var(--color-white);
  }
}

.nav--collapsed .nav-item {
  justify-content: center;
  padding: 10px 0;

  span {
    display: none;
  }
}
</style>
