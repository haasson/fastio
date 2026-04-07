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

const { canManageMenu, canManageOrders, canViewKitchen, canViewTables, canViewReservations, canManagePromotions, canViewContent, canViewSettings, canManageTeam } = usePermissions()
const modules = useModules()
const { menuLabel, isServices } = useTenantLabels()
const { blinkingCounter } = useNotificationPrefs()
const { count: newOrderCount } = useNewOrderCounter()
const { count: newReservationCount } = useNewReservationCounter()
const { count: unreadSupportCount } = useUnreadSupportCounter()

const canSeePromotions = computed(() => canManagePromotions.value && modules.promotions.value.enabled)
const canSeeOrders = computed(() => canManageOrders.value && (modules.delivery.value.enabled || modules.pickup.value.enabled || isServices.value))
const canSeeKitchen = computed(() => canViewKitchen.value && modules.kitchen.value.enabled)
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
  { to: '/help', icon: 'help', label: 'Помощь', counter: unreadSupportCount },
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
  justify-content: center;
  padding: 10px 0;

  span, .nav-counter {
    display: none;
  }
}
</style>
