<template>
  <UiSelect
    v-if="show"
    :value="branchStore.currentBranchId ?? ''"
    :options="branchOptions"
    class="branch-selector-root"
    @update:value="handleChange"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiSelect } from '@fastio/ui'
import { useBranchStore } from '~/shared/stores/branch'
import { useTenantStore } from '~/shared/stores/tenant'

const branchStore = useBranchStore()
const tenantStore = useTenantStore()

const currentMember = computed(() => tenantStore.memberships.find((m) => m.tenantId === tenantStore.currentTenantId),
)

const canSeeAll = computed(() => tenantStore.isOwner || (currentMember.value?.branchIds ?? []).length === 0,
)

const availableBranches = computed(() => {
  if (canSeeAll.value) return branchStore.branches

  const memberBranchIds = currentMember.value?.branchIds ?? []

  return branchStore.branches.filter((b) => memberBranchIds.includes(b.id))
})

const show = computed(() => availableBranches.value.length > 1)

const branchOptions = computed(() => [
  ...(canSeeAll.value && availableBranches.value.length > 1 ? [{ label: 'Все филиалы', value: '' }] : []),
  ...availableBranches.value.map((b) => ({ label: b.name, value: b.id })),
])

const handleChange = (val: string | number | (string | number)[] | null) => {
  const strVal = String(val ?? '')

  branchStore.setBranch(strVal === '' ? null : strVal)
}
</script>

<style scoped lang="scss">
.branch-selector-root {
  width: 100%;
}
</style>
