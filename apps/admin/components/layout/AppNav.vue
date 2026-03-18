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
      <span>{{ typeof item.label === 'string' ? item.label : item.label.value }}</span>
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
import type { IconName } from '@fastio/icons'
import { usePermissions } from '~/composables/auth/usePermissions'
import { useTenantLabels } from '~/composables/plan/useTenantLabels'
import { useModules } from '~/composables/plan/useModules'
import { useNotificationPrefs } from '~/composables/data/useNotificationPrefs'
import { useNewOrderCounter } from '~/composables/data/useNewOrderCounter'

defineProps<{ collapsed?: boolean }>()

type NavItem = { to: string; icon: IconName; label: string | ComputedRef<string>; visible?: ComputedRef<boolean> }

const { canManageMenu, canManageOrders, canManagePromotions, canViewSettings } = usePermissions()
const modules = useModules()
const { menuLabel } = useTenantLabels()
const { blinkingCounter } = useNotificationPrefs()
const { count: newOrderCount } = useNewOrderCounter()

const showOrdersBadge = computed(() => blinkingCounter.value && newOrderCount.value > 0)
const canSeePromotions = computed(() => canManagePromotions.value && modules.promotions.value.enabled)
const canSeeModifiers = computed(() => canManageMenu.value && modules.modifiers.value.enabled)
const canSeeAddons = computed(() => canManageMenu.value && modules.addons.value.enabled)
const canSeeOrders = computed(() => canManageOrders.value && (modules.delivery.value.enabled || modules.pickup.value.enabled))
const canSeeKitchen = computed(() => canManageOrders.value && modules.kitchen.value.enabled)
const canSeeTables = computed(() => canViewSettings.value && modules.dineIn.value.enabled)

const allNavItems: NavItem[] = [
  { to: '/', icon: 'dashboard', label: 'Дашборд' },
  { to: '/menu', icon: 'dishes', label: menuLabel, visible: canManageMenu },
  { to: '/menu/modifiers', icon: 'list', label: 'Модификаторы', visible: canSeeModifiers },
  { to: '/menu/addons', icon: 'plusRound', label: 'Добавки', visible: canSeeAddons },
  { to: '/orders', icon: 'orders', label: 'Заказы', visible: canSeeOrders },
  { to: '/kitchen', icon: 'chefHat', label: 'Кухня', visible: canSeeKitchen },
  { to: '/tables', icon: 'tableIcon', label: 'Столы', visible: canSeeTables },
  { to: '/promotions', icon: 'promotions', label: 'Акции', visible: canSeePromotions },
  { to: '/appearance', icon: 'layoutGrid', label: 'Сайт', visible: canViewSettings },
  { to: '/settings', icon: 'settings', label: 'Настройки', visible: canViewSettings },
]

const navItems = computed(() => allNavItems.filter((item) => !item.visible || item.visible.value))

const emit = defineEmits<{ navigate: [] }>()

defineExpose({ navItems })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

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
