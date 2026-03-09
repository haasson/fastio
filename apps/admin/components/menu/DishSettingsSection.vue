<template>
  <UiCollapseItem
    name="settings"
    title="Настройки"
  >
    <div class="content">
      <div class="toggle-row">
        <span class="label">Показывать в меню</span>
        <UiSwitch :model-value="active" @update:model-value="$emit('update:active', $event)" />
      </div>

      <template v-if="branches.length > 0">
        <div class="toggle-row">
          <span class="label">Разная цена по филиалам</span>
          <UiSwitch v-model="useBranchPrices" @update:model-value="onToggleBranchPrices" />
        </div>

        <div v-if="useBranchPrices" class="branch-prices">
          <div v-for="branch in branches" :key="branch.id" class="branch-price-row">
            <span class="branch-price-name">{{ branch.name }}</span>
            <UiInputNumber
              v-model="branchPrices[branch.id]"
              label=""
              :min="0"
              :placeholder="String(price ?? 0)"
            />
          </div>
        </div>
      </template>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiCollapseItem, UiSwitch, UiInputNumber } from '@fastio/ui'
import { useBranchStore } from '~/stores/branch'
import { useDishBranchPrices } from '~/composables/useDishBranchPrices'

const props = defineProps<{
  active: boolean
  dishId: string | null
  price: number | null
  refreshKey: number
}>()

defineEmits<{
  'update:active': [value: boolean]
}>()

const branchStore = useBranchStore()
const branches = computed(() => branchStore.branches)
const dishId = computed(() => props.dishId)
const refreshKey = computed(() => props.refreshKey)

const { useBranchPrices, branchPrices, onToggleBranchPrices, getBranchPrices }
  = useDishBranchPrices(dishId, branches, refreshKey)

defineExpose({ getBranchPrices })
</script>

<style scoped lang="scss">
.content {
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

.branch-prices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.branch-price-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.branch-price-name {
  flex: 1;
  font-size: 14px;
  color: var(--color-title);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
