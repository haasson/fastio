<template>
  <UiModal
    :model-value="modelValue"
    title="Добавить добавки"
    :width="440"
    :actions="pickerActions"
    :on-confirm="handleConfirm"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="content">
      <UiTabs v-model="pickerTab" :tabs="pickerTabs" />

      <!-- Таб: Добавки -->
      <div v-if="pickerTab === 'addons'" class="picker-list">
        <UiCheckbox
          v-for="addon in allAddons"
          :key="addon.id"
          :model-value="localIds.has(addon.id)"
          @update:model-value="toggleAddon(addon.id, $event)"
        >
          {{ addon.name }}
          <UiText size="tiny" color="secondary" span>
            · {{ addon.price }} ₽<template v-if="addon.weight"> · {{ addon.weight }} г</template>
          </UiText>
        </UiCheckbox>
      </div>

      <!-- Таб: Пресеты -->
      <div v-else class="preset-list">
        <UiEmpty v-if="presets.length === 0" text="Пресетов пока нет" />
        <button
          v-for="preset in presets"
          v-else
          :key="preset.id"
          class="preset-option"
          :class="{ selected: selectedPresetId === preset.id }"
          @click="selectedPresetId = preset.id"
        >
          <UiText size="small" :weight="600">{{ preset.name }}</UiText>
          <UiText size="tiny" color="secondary" class="preset-addons">
            {{ preset.addonIds.map(id => addonById(id)?.name).filter(Boolean).join(', ') || '—' }}
          </UiText>
        </button>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiModal, UiTabs, UiCheckbox, UiText, UiEmpty } from '@fastio/ui'
import type { Addon, AddonPreset } from '@fastio/shared'

const props = defineProps<{
  modelValue: boolean
  allAddons: Addon[]
  presets: AddonPreset[]
  selectedIds: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': [ids: string[]]
}>()

const pickerTab = ref('addons')
const selectedPresetId = ref<string | null>(null)
const localIds = ref(new Set<string>())

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      localIds.value = new Set(props.selectedIds)
      pickerTab.value = 'addons'
      selectedPresetId.value = null
    }
  },
)

const pickerTabs = [
  { value: 'addons', label: 'Добавки' },
  { value: 'presets', label: 'Пресеты' },
]

const pickerActions = computed(() => [
  pickerTab.value === 'presets' && selectedPresetId.value
    ? { text: 'Применить пресет', type: 'primary' as const, actionType: 'confirm' as const }
    : { text: 'Готово', type: 'primary' as const, actionType: 'confirm' as const },
])

const addonById = (id: string) => props.allAddons.find((a) => a.id === id)

const toggleAddon = (id: string, checked: boolean) => {
  const next = new Set(localIds.value)

  if (checked) next.add(id)
  else next.delete(id)
  localIds.value = next
}

const handleConfirm = () => {
  if (pickerTab.value === 'presets' && selectedPresetId.value) {
    const preset = props.presets.find((p) => p.id === selectedPresetId.value)

    if (preset) {
      const next = new Set(localIds.value)

      preset.addonIds.forEach((id) => next.add(id))
      localIds.value = next
    }
  }

  emit('confirm', [...localIds.value])
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
.content {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

.picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  max-height: 300px;
  overflow-y: auto;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-height: 300px;
  overflow-y: auto;
}

.preset-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-8);
  border: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    background: var(--color-bg-page);
  }

  &.selected {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }
}

.preset-addons {
  display: block;
  margin-top: var(--space-4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
