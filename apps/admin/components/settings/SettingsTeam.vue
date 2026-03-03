<template>
  <div class="team-root">
    <!-- Форма инвайта -->
    <div class="invite-form">
      <UiText size="tiny" span class="section-title">Пригласить в команду</UiText>
      <UiSpace :size="8" align="start">
        <UiInput v-model="inviteEmail" placeholder="email@example.com" :clearable="false" />
        <UiSelect v-model="inviteRole" :options="roleOptions" style="min-width: 160px" />
        <UiButton type="primary" :loading="inviting" @click="handleInvite">Пригласить</UiButton>
      </UiSpace>
      <UiAlert v-if="inviteError" type="error">{{ inviteError }}</UiAlert>
    </div>

    <!-- Участники -->
    <div>
      <UiText size="tiny" span class="section-title">Участники</UiText>

      <UiSkeleton v-if="team.loading.value" text :repeat="3" />

      <template v-else-if="team.members.value.length">
        <div v-for="m in team.members.value" :key="m.id" class="member-row">
          <div class="member-info">
            <UiText size="medium">{{ m.displayName || m.email }}</UiText>
            <UiText v-if="m.displayName && m.email" size="tiny">{{ m.email }}</UiText>
          </div>

          <UiTag :type="roleTagType(m.role)" size="small">{{ roleLabel(m.role) }}</UiTag>

          <UiSpace v-if="m.role !== 'owner' && canManageTeam" :size="4">
            <UiMenuDropdown
              :items="getRoleMenuItems(m)"
              @item-click="(name) => handleRoleMenuClick(m, name)"
            >
              <template #trigger>
                <UiButton type="text" size="small" icon="settings">Роль</UiButton>
              </template>
            </UiMenuDropdown>
            <UiButton type="text" size="small" @click="handleRemove(m)">Удалить</UiButton>
          </UiSpace>
        </div>
      </template>

      <UiText v-else size="small">Пока нет участников</UiText>
    </div>

    <!-- Pending инвайты -->
    <div v-if="team.invitations.value.length">
      <UiText size="tiny" span class="section-title">Ожидают принятия</UiText>

      <div v-for="inv in team.invitations.value" :key="inv.id" class="member-row">
        <div class="member-info">
          <UiText size="medium">{{ inv.email }}</UiText>
        </div>

        <UiTag :type="roleTagType(inv.role)" size="small">{{ roleLabel(inv.role) }}</UiTag>

        <UiButton
          v-if="canManageTeam"
          type="text"
          size="small"
          @click="handleCancelInvite(inv)"
        >
          Отменить
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  UiInput, UiSelect, UiButton, UiAlert, UiTag, UiText,
  UiSpace, UiSkeleton, UiMenuDropdown, useConfirm,
} from '@fastio/ui'
import type { UiMenuDropdownItem } from '@fastio/ui'
import type { TenantRole, TenantMember, TenantInvitation } from '@fastio/shared'
import { useTeam } from '~/composables/useTeam'
import { usePermissions } from '~/composables/usePermissions'
import { roleLabels, roleOptions, roleTagTypes } from '~/config/team-roles'

const team = useTeam()
const { canManageTeam } = usePermissions()
const { confirm } = useConfirm()

const inviteEmail = ref('')
const inviteRole = ref<TenantRole>('staff')
const inviting = ref(false)
const inviteError = ref('')

const roleLabel = (role: TenantRole) => roleLabels[role]
const roleTagType = (role: TenantRole) => roleTagTypes[role]

const getRoleMenuItems = (member: TenantMember): UiMenuDropdownItem[] => {
  const roles: TenantRole[] = ['admin', 'manager', 'staff']

  return roles.map((r) => ({
    name: r,
    label: roleLabels[r],
    checked: member.role === r,
  }))
}

const handleRoleMenuClick = async (member: TenantMember, roleName: string) => {
  if (roleName !== member.role) {
    await team.changeRole(member.id, roleName as TenantRole)
  }
}

const handleInvite = async () => {
  if (!inviteEmail.value) return

  inviting.value = true
  inviteError.value = ''

  const { error } = await team.invite(inviteEmail.value, inviteRole.value) ?? {}

  if (error) {
    inviteError.value = 'Не удалось отправить приглашение'
  } else {
    inviteEmail.value = ''
  }

  inviting.value = false
}

const handleRemove = async (member: TenantMember) => {
  const confirmed = await confirm({
    title: 'Удалить участника',
    message: `${member.email ?? member.displayName} будет удалён из команды`,
    confirmText: 'Удалить',
    confirmType: 'error',
  })

  if (confirmed) await team.removeMember(member.id)
}

const handleCancelInvite = async (inv: TenantInvitation) => {
  const confirmed = await confirm({
    title: 'Отменить приглашение',
    message: `Приглашение для ${inv.email} будет отменено`,
    confirmText: 'Отменить приглашение',
    confirmType: 'error',
  })

  if (confirmed) await team.cancelInvite(inv.id)
}

onMounted(() => team.load())
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/form' as *;

.team-root {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-title {
  @include section-title;
  margin-bottom: 12px;
}

.invite-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.member-info {
  flex: 1;
  min-width: 0;
}
</style>
