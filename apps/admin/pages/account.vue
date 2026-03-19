<template>
  <div class="account-root">
    <UiTabs :model-value="activeTab" :tabs="accountTabs" @update:model-value="goToTab" />

    <UiCard size="large">
      <NuxtPage />
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from '#imports'
import { UiTabs, UiCard } from '@fastio/ui'
import { usePermissions } from '~/composables/auth/usePermissions'

const { canManageBilling } = usePermissions()
const route = useRoute()
const router = useRouter()

const accountTabs = computed(() => [
  { value: 'profile', label: 'Профиль', icon: 'users' as const },
  ...(canManageBilling.value ? [{ value: 'billing', label: 'Тариф и баланс', icon: 'creditCard' as const }] : []),
])

const activeTab = computed(() => {
  const seg = route.path.split('/').at(-1) ?? ''
  const validValues = accountTabs.value.map((t) => t.value)

  return validValues.includes(seg) ? seg : 'profile'
})

const goToTab = (tab: string | number) => {
  router.push(`/account/${tab}`)
}
</script>

<style scoped lang="scss">
.account-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
