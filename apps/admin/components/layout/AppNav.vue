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
      <UiCounter
        v-if="item.to === '/orders' && showOrdersBadge"
        :value="newOrderCount"
        type="error"
        size="tiny"
        filled
        class="orders-counter"
        :class="{ blink: blinkingCounter }"
      />
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { UiIcon, UiCounter } from '@fastio/ui'
import type { IconName } from '@fastio/ui'
import { usePermissions } from '~/composables/usePermissions'
import { useNotificationPrefs } from '~/composables/useNotificationPrefs'
import { useNewOrderCounter } from '~/composables/useNewOrderCounter'

defineProps<{ collapsed?: boolean }>()

type NavItem = { to: string; icon: IconName; label: string; visible?: ComputedRef<boolean> }

const { canManageMenu, canManageOrders, canManagePromotions, canViewSettings } = usePermissions()
const { blinkingCounter } = useNotificationPrefs()
const { count: newOrderCount } = useNewOrderCounter()

const showOrdersBadge = computed(() => blinkingCounter.value && newOrderCount.value > 0)

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

.orders-counter {
  margin-left: auto;

  &.blink {
    animation: counter-blink 1.2s ease-in-out infinite;
  }
}

@keyframes counter-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.nav--collapsed .nav-item {
  justify-content: center;
  padding: 10px 0;

  span, .orders-counter {
    display: none;
  }
}
</style>
