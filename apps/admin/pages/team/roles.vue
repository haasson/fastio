<template>
  <div class="roles-root">
    <UiSectionHeader title="Роли">
      <template #right>
        <UiButton type="primary" size="small" @click="openCreate">Создать роль</UiButton>
      </template>
    </UiSectionHeader>

    <UiSkeleton v-if="tenantStore.rolesLoading" text :repeat="3" />

    <div v-else-if="tenantStore.roles.length" class="roles-list">
      <UiCard
        v-for="role in tenantStore.roles"
        :key="role.id"
        class="role-card"
      >
        <div class="role-header">
          <div class="role-info">
            <UiText size="small" class="role-name">{{ role.name }}</UiText>
          </div>
          <AppActionsBlock
            size="small"
            show-copy
            @edit="openEdit(role)"
            @copy="handleDuplicate(role)"
            @delete="handleDelete(role)"
          />
        </div>
        <UiText size="tiny" class="role-perms">
          {{ formatPermissionsSummary(role.permissions) }}
        </UiText>
      </UiCard>
    </div>

    <UiEmpty v-else description="Нет ролей" />

    <RoleEditModal
      v-model="showEditModal"
      :role="editingRole"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UiCard, UiText, UiButton, UiSkeleton, UiEmpty, UiSectionHeader, useConfirm, useMessage } from '@fastio/ui'
import AppActionsBlock from '~/shared/ui/components/AppActionsBlock.vue'
import type { TenantCustomRole, RolePermissions } from '@fastio/shared'
import RoleEditModal from '~/features/settings/components/RoleEditModal.vue'
import { useTenantStore } from '~/shared/stores/tenant'
import { useDatabase } from '~/shared/data/useDatabase'
import { permissionGroups } from '~/config/team-roles'

const tenantStore = useTenantStore()
const api = useDatabase()
const { confirm } = useConfirm()
const message = useMessage()

const showEditModal = ref(false)
const editingRole = ref<TenantCustomRole | null>(null)

const openCreate = () => {
  editingRole.value = null
  showEditModal.value = true
}

const openEdit = (role: TenantCustomRole) => {
  editingRole.value = role
  showEditModal.value = true
}

const handleDuplicate = (role: TenantCustomRole) => {
  editingRole.value = {
    ...role,
    id: '',
    name: `${role.name} (копия)`,
    isDefault: false,
  }
  showEditModal.value = true
}

const handleDelete = async (role: TenantCustomRole) => {
  const count = await api.roles.countMembers(role.id)

  if (count > 0) {
    message.warning(`Нельзя удалить роль — она назначена ${count} участникам`)

    return
  }

  const confirmed = await confirm({
    title: 'Удалить роль',
    message: `Роль «${role.name}» будет удалена`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (confirmed) {
    await tenantStore.removeRole(role.id)
    message.success('Роль удалена')
  }
}

const handleSaved = () => {
  tenantStore.loadRoles()
}

const formatPermissionsSummary = (permissions: RolePermissions) => {
  const enabled = permissionGroups
    .filter((g) => g.permissions.some((p) => permissions[p.key] === true))
    .map((g) => g.label)

  return enabled.length > 0 ? enabled.join(', ') : 'Нет прав'
}
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.roles-root {
  @include flex-col(var(--space-16));
}

.roles-list {
  @include flex-col;
}

.role-card {
  padding: var(--space-12) var(--space-16);
}

.role-header {
  @include flex-between;
}

.role-info {
  @include flex-row;
}

.role-name {
  font-weight: var(--font-weight-semibold);
}

.role-perms {
  color: var(--color-text-secondary);
  margin-top: var(--space-4);
}
</style>
