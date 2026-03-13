<template>
  <div class="branch-availability-rows-root">
    <div v-for="branch in branches" :key="branch.id" class="row">
      <span class="name">{{ branch.name }}</span>
      <slot :branch="branch" />
      <UiSwitch
        :model-value="branchActive[branch.id] !== false"
        @update:model-value="$emit('update:branchActive', branch.id, $event ? null : false)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiSwitch } from '@fastio/ui'
import type { Branch } from '@fastio/shared'

defineProps<{
  branches: Branch[]
  branchActive: Record<string, boolean | null>
}>()

defineEmits<{
  'update:branchActive': [branchId: string, value: boolean | null]
}>()
</script>

<style scoped lang="scss">
.branch-availability-rows-root {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.name {
  flex: 1;
  font-size: 14px;
  color: var(--color-title);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
