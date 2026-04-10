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
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiCollapseItem, UiSwitch } from '@fastio/ui'
import { useModules } from '~/composables/plan/useModules'

defineProps<{
  active: boolean
  requiresKitchen?: boolean
  entity: 'dish' | 'combo'
  entityId: string | null
  refreshKey: number
}>()

defineEmits<{
  'update:active': [value: boolean]
  'update:requiresKitchen': [value: boolean]
}>()

const modules = useModules()
const kitchenEnabled = computed(() => modules.kitchen.value.enabled)
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
</style>
