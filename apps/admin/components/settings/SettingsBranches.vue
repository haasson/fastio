<template>
  <div class="branches-root">
    <UiSectionHeader title="Филиалы">
      <template #right>
        <UiButton
          type="primary"
          icon="plus"
          size="small"
          @click="openAdd"
        >Добавить</UiButton>
      </template>
    </UiSectionHeader>

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
          <div v-if="deliveryEnabled && hasAnyZones && branchHasNoZones(branch.id)" class="branch-warning">
            <span class="branch-warning-text">Нет зон доставки — доставка не работает.</span>
            <NuxtLink to="/settings#delivery" class="branch-warning-link">Настроить зоны</NuxtLink>
          </div>
        </div>

        <div class="branch-actions">
          <UiIcon
            name="pencil"
            :size="18"
            class="branch-action"
            title="Настройки"
            @click="openEdit(branch)"
          />
          <UiIcon
            name="archive"
            :size="18"
            class="branch-action danger"
            title="Архивировать"
            @click="handleArchive(branch)"
          />
        </div>
      </div>
    </template>

    <UiText v-else size="small">Нет активных филиалов.</UiText>

    <!-- Архив -->
    <template v-if="archivedBranches.length">
      <UiDivider />
      <UiSectionHeader title="Архив" />
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

    <BranchDrawer
      v-model="drawerOpen"
      :branch="editingBranch"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { UiButton, UiIcon, UiText, UiTag, UiSkeleton, UiDivider, useConfirm } from '@fastio/ui'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import type { Branch, BranchFormData } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'
import { useBranchStore } from '~/stores/branch'
import { useDatabase } from '~/composables/data/useDatabase'
import { useAllDeliveryZones } from '~/composables/delivery/useAllDeliveryZones'
import BranchDrawer from './BranchDrawer.vue'

const tenantStore = useTenantStore()
const branchStore = useBranchStore()
const api = useDatabase()
const tenantId = computed(() => tenantStore.tenant?.id ?? '')
const { branches, archivedBranches, loading } = storeToRefs(branchStore)
const { add, update, archive, restore } = branchStore
const { confirm } = useConfirm()
const { zones } = useAllDeliveryZones()

const deliveryEnabled = computed(() => tenantStore.tenant?.deliveryEnabled ?? false)
const hasAnyZones = computed(() => zones.value.length > 0)
const branchHasNoZones = (branchId: string) => !zones.value.some((z) => z.branchId === branchId)

const drawerOpen = ref(false)
const editingBranch = ref<Branch | null>(null)
const archivingId = ref<string | null>(null)

const openAdd = () => {
  editingBranch.value = null
  drawerOpen.value = true
}

const openEdit = (branch: Branch) => {
  editingBranch.value = branch
  drawerOpen.value = true
}

const handleSave = async (data: BranchFormData) => {
  if (editingBranch.value) {
    await update(editingBranch.value.id, data)
  } else {
    await add(data)
  }
  drawerOpen.value = false
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

  if (!confirmed) return
  await restore(branch.id)
}
</script>

<style scoped lang="scss">
.branches-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.branch-warning {
  display: flex;
  align-items: center;
  gap: 6px;
}

.branch-warning-text {
  font-size: 12px;
  color: var(--color-error);
}

.branch-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.branch-action {
  cursor: pointer;
  color: var(--color-text-hint);

  &:hover { color: var(--color-text); }
  &.danger { color: var(--color-error); }
}

.branch-warning-link {
  font-size: 12px;
  color: var(--color-primary);
  text-decoration: none;

  &:hover { text-decoration: underline; }
}
</style>
