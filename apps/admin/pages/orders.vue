<template>
  <div class="orders-layout-root">
    <UiTabs
      v-if="ordersTabs.length > 1"
      :model-value="activeTab"
      :tabs="ordersTabs"
      @update:model-value="goToTab"
    />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiTabs } from '@fastio/ui'
import { useModules } from '~/composables/plan/useModules'
import { usePermissions } from '~/composables/auth/usePermissions'

const modules = useModules()
const { canManageTeam } = usePermissions()

const route = useRoute()
const router = useRouter()

const ordersTabs = computed(() => [
  { value: 'orders', label: 'Заказы', icon: 'orders' as const },
  ...(modules.delivery.value.active ? [{ value: 'delivery', label: 'Доставка', icon: 'bike' as const }] : []),
  ...(canManageTeam.value ? [{ value: 'order-number', label: 'Нумерация', icon: 'hash' as const }] : []),
])

const activeTab = computed(() => {
  const seg = route.path.split('/').at(-1) ?? ''
  const validValues = ordersTabs.value.map((t) => t.value)

  return validValues.includes(seg) ? seg : 'orders'
})

const goToTab = (tab: string | number) => {
  router.push(tab === 'orders' ? '/orders' : `/orders/${tab}`)
}
</script>

<style scoped lang="scss">
.orders-layout-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
