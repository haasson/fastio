<template>
  <UiCollapseItem name="availability" title="Доступность">
    <div class="settings-section-root">
      <div class="toggle-row toggle-row--first">
        <span class="label">Показывать в меню</span>
        <UiSwitch :model-value="active" @update:model-value="$emit('update:active', $event)" />
      </div>

      <div v-if="active && branchOptions.length > 1" class="branches-block">
        <div class="branches-label">Филиалы</div>
        <div
          v-for="b in branchOptions"
          :key="b.value"
          class="branch-toggle-row"
        >
          <span class="label">{{ b.label }}</span>
          <UiSwitch
            :model-value="branchToggle.isOn(b.value)"
            :disabled="branchToggle.isLastOn(b.value)"
            @update:model-value="branchToggle.toggle(b.value, $event)"
          />
        </div>
      </div>

      <div v-if="entity === 'dish' && kitchenEnabled" class="toggle-row">
        <span class="label">Готовить на кухне</span>
        <UiSwitch :model-value="requiresKitchen" @update:model-value="$emit('update:requiresKitchen', $event)" />
      </div>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { UiCollapseItem, UiSwitch } from '@fastio/ui'
import { useGate } from '~/composables/plan/useGate'
import { useBranchToggle } from '~/features/branches'

const props = defineProps<{
  active: boolean
  requiresKitchen?: boolean
  entity: 'dish' | 'combo'
  branchIds: string[]
  branchOptions: { label: string; value: string }[]
}>()

const emit = defineEmits<{
  'update:active': [value: boolean]
  'update:requiresKitchen': [value: boolean]
  'update:branchIds': [value: string[]]
}>()

const gate = useGate()
const kitchenEnabled = computed(() => gate.kitchen.value.enabled)

const branchToggle = useBranchToggle(
  toRef(props, 'branchIds'),
  toRef(props, 'branchOptions'),
  (next) => emit('update:branchIds', next),
)
</script>

<style scoped lang="scss">
.settings-section-root {
  display: flex;
  flex-direction: column;
}

.branches-block {
  display: flex;
  flex-direction: column;
}

.branches-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  padding: var(--space-12) 0 var(--space-4);
}

.branch-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-8) 0;
  border-top: 1px solid var(--color-border);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-8) 0;
  border-top: 1px solid var(--color-border);

  &--first {
    border-top: none;
  }
}

.label {
  font-size: var(--font-size-md);
  color: var(--color-text);
}
</style>
