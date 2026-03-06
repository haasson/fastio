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
import { useTenantStore } from '~/stores/tenant'
import { roleLabels } from '~/config/team-roles'

const tenantStore = useTenantStore()

const tenantOptions = computed(() => tenantStore.memberships.map((membership) => ({
  label: `${membership.tenant?.name ?? 'Без названия'} (${roleLabels[membership.role]})`,
  value: membership.tenantId,
})),
)

const currentTenantId = computed({
  get: () => tenantStore.currentTenantId ?? '',
  set: (id: string) => tenantStore.switchTenant(id),
})
</script>

<style scoped lang="scss">
.switcher-root {
  padding: 0 10px;
  margin-bottom: 8px;
}
</style>
