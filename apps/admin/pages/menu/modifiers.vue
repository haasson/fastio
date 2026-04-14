<template>
  <div class="modifiers-root">
    <div class="toolbar">
      <UiButton
        data-tour="add-modifier"
        type="primary"
        icon="plus"
        @click="openAdd"
      >
        Добавить группу
      </UiButton>
    </div>

    <UiSkeleton v-if="loading" :height="56" :count="3" />

    <UiEmpty
      v-else-if="groups.length === 0"
      icon="settings"
      text="Модификаторов пока нет. Создайте первую группу — например «Размер» или «Бортик»."
    />

    <UiDataTable
      v-else
      :columns="columns"
      :data="groups"
      :row-key="(row: ModifierGroup) => row.id"
      :bordered="false"
      size="small"
    />

    <ModifierGroupFormModal
      v-model="showModal"
      :group="editingGroup"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiDataTable, UiEmpty, UiSkeleton } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import type { ModifierGroup } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useModifierGroups } from '~/composables/data/useModifierGroups'
import { buildModifierColumns } from '~/columns/modifiers'
import ModifierGroupFormModal from '~/components/menu/ModifierGroupFormModal.vue'

const tenantStore = useTenantStore()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const { groups, loading, add, update, remove, toggleActive } = useModifierGroups(tenantId)

const showModal = ref(false)
const editingGroup = ref<ModifierGroup | null>(null)

const { confirm } = useConfirm()

const openAdd = () => {
  editingGroup.value = null
  showModal.value = true
}

const openEdit = (group: ModifierGroup) => {
  editingGroup.value = group
  showModal.value = true
}

const handleSave = async (data: Parameters<typeof add>[0]) => {
  if (editingGroup.value) {
    await update(editingGroup.value.id, data)
  } else {
    await add(data)
  }
  showModal.value = false
}

const handleRemove = async (group: ModifierGroup) => {
  const ok = await confirm({
    title: 'Удалить модификатор?',
    message: `Группа «${group.name}» будет удалена. Привязки к блюдам тоже исчезнут.`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (ok) await remove(group.id)
}

const columns = buildModifierColumns({
  onToggle: toggleActive,
  onEdit: openEdit,
  onRemove: handleRemove,
})
</script>

<style scoped lang="scss">
.modifiers-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

:deep(.options-cell) {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}
</style>
