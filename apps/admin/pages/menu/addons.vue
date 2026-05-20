<template>
  <div class="addons-root">
    <div class="max-addons-setting" data-tour="addon-max-setting">
      <UiCheckbox :model-value="maxAddonsDefault != null" @update:model-value="toggleMaxAddons">
        <UiText size="small">{{ `Ограничить количество добавок на ${item.acc}` }}</UiText>
      </UiCheckbox>
      <UiInputNumber
        v-if="maxAddonsDefault != null"
        v-model="maxAddonsDefault"
        :min="1"
        :show-button="true"
        placeholder="3"
        class="max-addons-input"
        @update:model-value="saveMaxAddons"
      />
    </div>

    <div class="toolbar" data-tour="addon-toolbar">
      <UiTabs
        v-model="activeTab"
        variant="pill"
        :tabs="tabs"
        data-tour="addon-tabs"
      />
      <UiButton
        type="primary"
        icon="plus"
        data-tour="add-addon"
        @click="openAdd"
      >
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
          :row-key="(row: Addon) => row.id"
          :bordered="false"
          size="small"
        />
      </template>
    </template>

    <!-- Пресеты -->
    <template v-else>
      <UiSkeleton v-if="presetsLoading" :height="56" :count="3" />

      <UiEmpty v-else-if="presets.length === 0">
        {{ `Пресеты позволяют быстро назначать наборы добавок на ${item.plural.acc}.` }}
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
          :row-key="(row: AddonPreset) => row.id"
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
import { storeToRefs } from 'pinia'
import { useDebounceFn } from '@vueuse/core'
import { UiButton, UiSkeleton, UiTabs, UiDataTable, UiInput, UiEmpty, UiCheckbox, UiInputNumber, UiText, useMessage } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { Addon, AddonPreset } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { useAddons } from '~/features/menu'
import { useTerms } from '~/features/legal'
import { buildAddonColumns, buildAddonPresetColumns } from '~/columns/addons'
import AddonFormModal from '~/features/menu/components/AddonFormModal.vue'
import AddonPresetFormModal from '~/features/menu/components/AddonPresetFormModal.vue'
import { reportError } from '@fastio/shared/observability'

const db = useDatabase()
const tenantStore = useTenantStore()
const { tenantId } = storeToRefs(tenantStore)

const maxAddonsDefault = ref<number | null>(tenantStore.tenant.maxAddonsDefault ?? null)

const toggleMaxAddons = (checked: boolean) => {
  maxAddonsDefault.value = checked ? 3 : null
  saveMaxAddons()
}

const saveMaxAddons = useDebounceFn(() => {
  db.tenants.update(tenantId.value, { maxAddonsDefault: maxAddonsDefault.value })
}, 300)
const {
  addons, loading, presets, presetsLoading, loadPresets,
  remove, toggleActive, removePreset,
} = useAddons(tenantId)

onMounted(loadPresets)

const { confirm } = useConfirm()
const { item } = useTerms()
const message = useMessage()

const tabs = [
  { value: 'addons', label: 'Добавки', attrs: { 'data-tour': 'addon-tab-addons' } },
  { value: 'presets', label: 'Пресеты', attrs: { 'data-tour': 'addon-tab-presets' } },
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
    message: `«${addon.name}» будет удалена. Привязки к ${item.plural.dat} тоже исчезнут.`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (ok) {
    try {
      await remove(addon.id)
    } catch (e) {
      reportError(e, { context: 'menu/addons:handleRemoveAddon', addonId: addon.id })
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
    } catch (e) {
      reportError(e, { context: 'menu/addons:handleRemovePreset', presetId: preset.id })
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
@use '@fastio/styles/mixins/layout' as *;

.addons-root {
  @include flex-col(var(--space-16));
}

.toolbar {
  @include flex-between(var(--space-12));
}

.max-addons-setting {
  @include flex-row(var(--space-12));
}

.max-addons-input {
  width: 100px;
}

.search {
  max-width: 320px;
}
</style>
