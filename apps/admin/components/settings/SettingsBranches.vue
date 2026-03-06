<template>
  <div class="branches-root">
    <div class="header">
      <UiText size="tiny" span class="section-title">Филиалы</UiText>
      <UiButton
        type="primary"
        icon="plus"
        size="small"
        @click="openAdd"
      >Добавить</UiButton>
    </div>

    <UiSkeleton v-if="loading" text :repeat="3" />

    <template v-else-if="branches.length">
      <div v-for="branch in branches" :key="branch.id" class="branch-row">
        <div class="branch-info">
          <div class="branch-name-wrap">
            <UiText size="medium" class="branch-name">{{ branch.name }}</UiText>
            <UiTag v-if="!branch.isActive" type="warning" size="small">Неактивен</UiTag>
          </div>
          <UiText v-if="branch.address" size="tiny" class="branch-address">{{ branch.address }}</UiText>
          <UiText v-if="branch.phone" size="tiny" class="branch-phone">{{ branch.phone }}</UiText>
        </div>

        <UiSpace :size="4">
          <UiButton
            type="text"
            size="medium"
            icon="pencil"
            title="Редактировать"
            @click="openEdit(branch)"
          />
          <UiButton
            type="text"
            size="medium"
            icon="trash"
            title="Удалить"
            @click="handleRemove(branch)"
          />
        </UiSpace>
      </div>
    </template>

    <UiText v-else size="small">Нет филиалов. Добавьте первый.</UiText>

    <BranchFormModal
      v-model="modalOpen"
      :branch="editingBranch"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiText, UiTag, UiSpace, UiSkeleton, useConfirm } from '@fastio/ui'
import type { Branch, BranchFormData } from '@fastio/shared'
import { useBranches } from '~/composables/useBranches'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import BranchFormModal from './BranchFormModal.vue'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const { branches, loading, add, update, remove } = useBranches(tenantId)
const { confirm } = useConfirm()

const modalOpen = ref(false)
const editingBranch = ref<Branch | null>(null)

const openAdd = () => {
  editingBranch.value = null
  modalOpen.value = true
}

const openEdit = (branch: Branch) => {
  editingBranch.value = branch
  modalOpen.value = true
}

const handleSave = async (data: BranchFormData) => {
  if (editingBranch.value) {
    await update(editingBranch.value.id, data)
  } else {
    await add(data)
  }
  modalOpen.value = false
}

const handleRemove = async (branch: Branch) => {
  const confirmed = await confirm({
    title: 'Удалить филиал',
    message: `Филиал «${branch.name}» будет удалён`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (confirmed) {
    if (branchStore.currentBranchId === branch.id) branchStore.setBranch(null)
    await remove(branch.id)
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/form' as *;

.branches-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  @include section-title;
}

.branch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.branch-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.branch-name-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.branch-name {
  font-weight: 600;
}

.branch-address,
.branch-phone {
  color: var(--color-text-hint);
}
</style>
