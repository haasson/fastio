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
            icon="archive"
            title="Архивировать"
            :loading="archivingId === branch.id"
            @click="handleArchive(branch)"
          />
        </UiSpace>
      </div>
    </template>

    <UiText v-else size="small">Нет активных филиалов.</UiText>

    <!-- Архив -->
    <template v-if="archivedBranches.length">
      <UiDivider />
      <UiText size="tiny" span class="section-title">Архив</UiText>
      <div v-for="branch in archivedBranches" :key="branch.id" class="branch-row archived">
        <div class="branch-info">
          <UiText size="medium" class="branch-name">{{ branch.name }}</UiText>
          <UiText v-if="branch.address" size="tiny" class="branch-address">{{ branch.address }}</UiText>
        </div>
        <UiButton
          type="text"
          size="medium"
          icon="archiveRestore"
          title="Восстановить"
          @click="handleRestore(branch)"
        />
      </div>
    </template>

    <BranchFormModal
      v-model="modalOpen"
      :branch="editingBranch"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiText, UiTag, UiSpace, UiSkeleton, UiDivider, useConfirm } from '@fastio/ui'
import type { Branch, BranchFormData } from '@fastio/shared'
import { useBranches } from '~/composables/useBranches'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useSupabaseApi } from '~/composables/useSupabaseApi'
import BranchFormModal from './BranchFormModal.vue'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const api = useSupabaseApi()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const { branches, archivedBranches, loading, add, update, archive, restore } = useBranches(tenantId)
const { confirm } = useConfirm()

const modalOpen = ref(false)
const editingBranch = ref<Branch | null>(null)
const archivingId = ref<string | null>(null)

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

const handleArchive = async (branch: Branch) => {
  archivingId.value = branch.id
  const hasActive = await api.branches.hasActiveOrders(branch.id, tenantId.value)

  archivingId.value = null

  if (hasActive) {
    await confirm({
      title: 'Нельзя архивировать филиал',
      message: `У филиала «${branch.name}» есть активные заказы. Переведите все заказы в статус «Выполнен» или «Отменён», а затем попробуйте снова.`,
      confirmText: false,
      cancelText: 'Понятно',
    })

    return
  }

  const confirmed = await confirm({
    title: 'Архивировать филиал?',
    message: `Филиал «${branch.name}» будет скрыт. Его можно будет восстановить из архива.`,
    confirmText: 'Архивировать',
  })

  if (!confirmed) return

  if (branchStore.currentBranchId === branch.id) branchStore.setBranch(null)
  await archive(branch.id)
}

const handleRestore = async (branch: Branch) => {
  const confirmed = await confirm({
    title: 'Восстановить филиал?',
    message: `Филиал «${branch.name}» снова станет активным.`,
    confirmText: 'Восстановить',
  })

  if (confirmed) await restore(branch.id)
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

  &.archived {
    opacity: 0.6;
  }
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
