<template>
  <div class="addons-root">
    <div class="toolbar">
      <UiTabs v-model="activeTab" variant="pill" :tabs="tabs" />
      <UiButton type="primary" icon="plus" @click="openAdd">
        {{ activeTab === 'addons' ? 'Добавка' : 'Пресет' }}
      </UiButton>
    </div>

    <!-- Добавки -->
    <template v-if="activeTab === 'addons'">
      <UiSkeleton v-if="loading" :height="56" :count="4" />

      <UiEmpty v-else-if="addons.length === 0">
        Добавок пока нет. Создайте первую — например «Халапеньо» или «Соус барбекю».
      </UiEmpty>

      <template v-else>
        <UiInput
          v-model="addonSearch"
          placeholder="Поиск по названию..."
          clearable
          class="search"
        />

        <UiDataTable
          :columns="addonColumns"
          :data="filteredAddons"
          :row-key="(row) => row.id"
          :bordered="false"
          size="small"
        />
      </template>
    </template>

    <!-- Пресеты -->
    <template v-else>
      <UiSkeleton v-if="presetsLoading" :height="56" :count="3" />

      <UiEmpty v-else-if="presets.length === 0">
        Пресеты позволяют быстро назначать наборы добавок на блюда.
      </UiEmpty>

      <template v-else>
        <UiInput
          v-model="presetSearch"
          placeholder="Поиск по названию..."
          clearable
          class="search"
        />

        <UiDataTable
          :columns="presetColumns"
          :data="filteredPresets"
          :row-key="(row) => row.id"
          :bordered="false"
          size="small"
        />
      </template>
    </template>

    <AddonFormModal
      v-model="showAddonModal"
      :tenant-id="tenantId"
      :addon="editingAddon"
    />

    <AddonPresetFormModal
      v-model="showPresetModal"
      :tenant-id="tenantId"
      :preset="editingPreset"
      :addons="addons"
      @saved="loadPresets"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { UiButton, UiSkeleton, UiTabs, UiDataTable, UiInput, UiEmpty, useMessage } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Addon, AddonPreset } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useAddons } from '~/composables/data/useAddons'
import { buildAddonColumns, buildAddonPresetColumns } from '~/columns/addons'
import AddonFormModal from '~/components/menu/AddonFormModal.vue'
import AddonPresetFormModal from '~/components/menu/AddonPresetFormModal.vue'

const tenantStore = useTenantStore()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const {
  addons, loading, presets, presetsLoading, loadPresets,
  remove, toggleActive, removePreset,
} = useAddons(tenantId)

onMounted(loadPresets)

const { confirm } = useConfirm()
const message = useMessage()

const tabs = [
  { value: 'addons', label: 'Добавки' },
  { value: 'presets', label: 'Пресеты' },
]
const activeTab = ref('addons')

const addonSearch = ref('')
const presetSearch = ref('')

const filteredAddons = computed(() => {
  const q = addonSearch.value.trim().toLowerCase()

  return q ? addons.value.filter((a) => a.name.toLowerCase().includes(q)) : addons.value
})

const filteredPresets = computed(() => {
  const q = presetSearch.value.trim().toLowerCase()

  return q ? presets.value.filter((p) => p.name.toLowerCase().includes(q)) : presets.value
})

const showAddonModal = ref(false)
const editingAddon = ref<Addon | null>(null)

const showPresetModal = ref(false)
const editingPreset = ref<AddonPreset | null>(null)

const openAdd = () => {
  if (activeTab.value === 'addons') {
    editingAddon.value = null
    showAddonModal.value = true
  } else {
    editingPreset.value = null
    showPresetModal.value = true
  }
}

const addonById = (id: string) => addons.value.find((a) => a.id === id)

const handleRemoveAddon = async (addon: Addon) => {
  const ok = await confirm({
    title: 'Удалить добавку?',
    message: `«${addon.name}» будет удалена. Привязки к блюдам тоже исчезнут.`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (ok) {
    try {
      await remove(addon.id)
    } catch {
      message.error('Не удалось удалить добавку')
    }
  }
}

const handleRemovePreset = async (preset: AddonPreset) => {
  const ok = await confirm({
    title: 'Удалить пресет?',
    message: `Пресет «${preset.name}» будет удалён.`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (ok) {
    try {
      await removePreset(preset.id)
    } catch {
      message.error('Не удалось удалить пресет')
    }
  }
}

const addonColumns = buildAddonColumns({
  onToggle: toggleActive,
  onEdit: (addon) => {
    editingAddon.value = addon
    showAddonModal.value = true
  },
  onRemove: handleRemoveAddon,
})

const presetColumns = buildAddonPresetColumns({
  onEdit: (preset) => {
    editingPreset.value = preset
    showPresetModal.value = true
  },
  onRemove: handleRemovePreset,
  addonById,
})
</script>

<style scoped lang="scss">
.addons-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.search {
  max-width: 320px;
}
</style>
