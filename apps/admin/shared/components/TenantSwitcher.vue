<template>
  <div v-if="tenantStore.hasMultipleTenants" class="switcher-root">
    <UiSelect
      v-model:value="currentTenantId"
      :options="tenantOptions"
      size="small"
      stateless
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiSelect } from '@fastio/ui'
import { useTenantStore } from '~/shared/stores/tenant'
const tenantStore = useTenantStore()

const getRoleName = (membership: { roleId: string | null; roleName: string | null }) => {
  if (membership.roleId === null) return 'Владелец'

  return membership.roleName ?? '—'
}

const tenantOptions = computed(() => tenantStore.memberships.map((membership) => ({
  label: `${membership.tenant?.name ?? 'Без названия'} (${getRoleName(membership)})`,
  value: membership.tenantId,
})),
)

// Hard-reload вместо in-memory swap: смена тенанта затрагивает много
// module-level state'ов (channels, counters, gates), и накапливаются
// костыли при попытке всё сбросить вручную. Ререндер с нуля проще и
// надёжнее — заодно гарантирует свежую инициализацию.
const currentTenantId = computed({
  get: () => tenantStore.currentTenantId ?? '',
  set: (id: string) => {
    if (id === tenantStore.currentTenantId) return
    tenantStore.switchTenant(id)
    window.location.href = '/'
  },
})
</script>

<style scoped lang="scss">
.switcher-root {
  width: 100%;
}
</style>
