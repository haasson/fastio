<template>
  <TabsLayout
    :tabs="tabs"
    base-path="/team"
    card
    hide-single
  />
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { useTenantStore } from '~/stores/tenant'
import { usePermissions } from '~/composables/auth/usePermissions'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Команда')

const tenantStore = useTenantStore()
const { canManageRoles } = usePermissions()

const tabs = computed(() => {
  const list = [
    { value: 'members', label: 'Участники' },
  ]

  if (canManageRoles.value) {
    list.push({ value: 'roles', label: 'Роли' })
  }

  return list
})

onMounted(() => tenantStore.init())
</script>
