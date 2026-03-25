<template>
  <UiCollapseItem name="settings" title="Настройки">
    <div class="settings-section-root">
      <div class="toggle-row">
        <span class="label">Показывать в меню</span>
        <UiSwitch :model-value="active" @update:model-value="$emit('update:active', $event)" />
      </div>

      <div v-if="entity === 'dish' && kitchenEnabled" class="toggle-row">
        <span class="label">Готовить на кухне</span>
        <UiSwitch :model-value="requiresKitchen" @update:model-value="$emit('update:requiresKitchen', $event)" />
      </div>

      <template v-if="branches.length > 0">
        <div class="toggle-row">
          <span class="label">Разные настройки по филиалам</span>
          <UiSwitch v-model="useBranchSettings" @update:model-value="onToggle" />
        </div>

        <BranchAvailabilityRows
          v-if="useBranchSettings"
          :branches="branches"
          :branch-active="branchActive"
          @update:branch-active="setBranchActive"
        >
          <template #default="{ branch }">
            <UiInputNumber
              v-model="branchPrices[branch.id]"
              label=""
              :min="0"
              :placeholder="String(price ?? 0)"
              class="price-input"
            />
          </template>
        </BranchAvailabilityRows>
      </template>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'
import { UiCollapseItem, UiSwitch, UiInputNumber } from '@fastio/ui'
import { useBranchStore } from '~/stores/branch'
import { useModules } from '~/composables/plan/useModules'
import { useEntityBranchSettings } from '~/composables/data/useEntityBranchSettings'
import BranchAvailabilityRows from './BranchAvailabilityRows.vue'

const props = defineProps<{
  active: boolean
  requiresKitchen?: boolean
  entity: 'dish' | 'combo'
  entityId: string | null
  refreshKey: number
  price?: number | null
}>()

defineEmits<{
  'update:active': [value: boolean]
  'update:requiresKitchen': [value: boolean]
}>()

const modules = useModules()
const kitchenEnabled = computed(() => modules.kitchen.value.enabled)

const branchStore = useBranchStore()
const branches = computed(() => branchStore.branches)
const { entity: entityRef, entityId: entityIdRef, refreshKey: refreshKeyRef } = toRefs(props)

const { useBranchSettings, branchPrices, branchActive, onToggle, getSettings, setBranchActive }
  = useEntityBranchSettings(entityRef, entityIdRef, branches, refreshKeyRef)

defineExpose({ getSettings })
</script>

<style scoped lang="scss">
.settings-section-root {
  display: flex;
  flex-direction: column;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
}

.label {
  font-size: 14px;
  color: var(--color-text);
}

.price-input {
  width: 120px;
  flex-shrink: 0;
}
</style>
