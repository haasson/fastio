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
        v-if="item.counter?.value"
        :value="item.counter.value"
        type="error"
        size="tiny"
        filled
        class="nav-counter"
        :class="{ blink: item.blink?.value }"
      />
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { UiIcon, UiCounter } from '@fastio/ui'
import type { IconName } from '@fastio/icons'
import { usePermissions } from '~/composables/auth/usePermissions'
import { AUDIT_LOG_ENABLED } from '~/utils/featureFlags'
import { useTenantLabels } from '~/composables/plan/useTenantLabels'
import { useModules } from '~/composables/plan/useModules'
import { useNotificationPrefs } from '~/composables/data/useNotificationPrefs'
import { useNewOrderCounter } from '~/composables/data/useNewOrderCounter'
import { useNewReservationCounter } from '~/composables/data/useNewReservationCounter'
import { useUnreadSupportCounter } from '~/composables/data/useUnreadSupportCounter'

defineProps<{ collapsed?: boolean }>()

type NavItem = {
  to: string
  icon: IconName
  label: string | ComputedRef<string>
  visible?: ComputedRef<boolean>
  counter?: Ref<number> | ComputedRef<number>
  blink?: ComputedRef<boolean>
}

const { canManageMenu, canManageOrders, canViewKitchen, canViewKitchenOverview, canViewTables, canViewReservations, canManagePromotions, canViewContent, canViewSettings, canViewAuditLog, canManageTeam } = usePermissions()
const modules = useModules()
const { menuLabel, isServices } = useTenantLabels()
const { blinkingCounter } = useNotificationPrefs()
const { count: newOrderCount } = useNewOrderCounter()
const { count: newReservationCount } = useNewReservationCounter()
const { count: unreadSupportCount } = useUnreadSupportCounter()

const canSeePromotions = computed(() => canManagePromotions.value && modules.promotions.value.enabled)
const canSeeOrders = computed(() => canManageOrders.value && (modules.delivery.value.enabled || modules.pickup.value.enabled || isServices.value))
const canSeeKitchen = computed(() => (canViewKitchen.value || canViewKitchenOverview.value) && modules.kitchen.value.enabled)
const canSeeTables = computed(() => canViewTables.value && modules.dineIn.value.enabled)
const canSeeReservations = computed(() => canViewReservations.value && (modules.reservations?.value?.enabled ?? false))
const canSeeBranches = computed(() => canManageTeam.value && !isServices.value)

const orderCounter = computed(() => blinkingCounter.value ? newOrderCount.value : 0)
const orderBlink = computed(() => blinkingCounter.value && newOrderCount.value > 0)

const allNavItems: NavItem[] = [
  { to: '/', icon: 'dashboard', label: 'Дашборд' },
  { to: '/menu', icon: 'dishes', label: menuLabel, visible: canManageMenu },
  { to: '/orders', icon: 'orders', label: 'Заказы', visible: canSeeOrders, counter: orderCounter, blink: orderBlink },
  { to: '/kitchen', icon: 'chefHat', label: 'Кухня', visible: canSeeKitchen },
  { to: '/tables', icon: 'tableIcon', label: 'Столы', visible: canSeeTables },
  { to: '/reservations', icon: 'calendar', label: 'Бронирование', visible: canSeeReservations, counter: newReservationCount },
  { to: '/promotions', icon: 'promotions', label: 'Акции', visible: canSeePromotions },
  { to: '/team/members', icon: 'users', label: 'Команда', visible: computed(() => canManageTeam.value && !isServices.value) },
  { to: '/team/branches', icon: 'mapPin', label: 'Филиалы', visible: canSeeBranches },
  { to: '/content', icon: 'fileText', label: 'Контент сайта', visible: canViewContent },
  { to: '/appearance', icon: 'layoutGrid', label: 'Сайт', visible: canViewContent },
  { to: '/settings', icon: 'settings', label: 'Настройки', visible: canViewSettings },
  ...(AUDIT_LOG_ENABLED ? [{ to: '/audit-log', icon: 'list' as const, label: 'Журнал действий', visible: canViewAuditLog }] : []),
  { to: '/help', icon: 'help', label: 'Помощь', counter: unreadSupportCount },
]

const navItems = computed(() => allNavItems.filter((item) => !item.visible || item.visible.value))

const emit = defineEmits<{ navigate: [] }>()

defineExpose({ navItems })
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;
@use '@fastio/styles/mixins/layout' as *;

.nav {
  @include flex-col(var(--space-4));

  flex: 1;
  padding: var(--space-8) var(--space-12) 0;
}

.nav-item {
  @include flex-row(var(--space-12));

  height: 38px;
  padding: 0 var(--space-12);
  border-radius: var(--radius-8);
  color: var(--grey-400);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  span {
    opacity: 1;
    transition: opacity 0.15s 0.15s;
  }

  &:hover {
    background: var(--grey-800);
    color: var(--grey-50);
  }

  &.active {
    background: var(--color-primary);
    color: var(--color-white);
  }
}

.nav-counter {
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
  position: relative;

  span {
    opacity: 0;
    width: 0;
    transition: opacity 0.1s;
  }

  .nav-counter {
    position: absolute;
    top: 4px;
    right: 4px;
    margin-left: 0;
    min-width: 8px;
    height: 8px;
    padding: 0;
    font-size: 0;
    border-radius: 50%;
  }
}
</style>
