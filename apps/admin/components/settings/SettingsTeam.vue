<template>
  <div class="team-root">
    <!-- Форма инвайта -->
    <UiForm ref="inviteFormRef" class="invite-form">
      <UiText size="tiny" span class="section-title">Пригласить в команду</UiText>
      <UiSpace :size="8" align="start">
        <UiInput
          v-model="inviteEmail"
          name="email"
          placeholder="email@example.com"
          :clearable="false"
          :rules="[
            { type: 'required', message: 'Введите email' },
            { type: 'email', message: 'Некорректный email' },
          ]"
        />
        <UiSelect v-model="inviteRole" :options="roleOptions" style="min-width: 160px" />
        <UiButton type="primary" :loading="inviting" @click="handleInvite">Пригласить</UiButton>
      </UiSpace>

      <template v-if="branches.length > 0 && inviteRole !== 'admin' && inviteRole !== 'owner'">
        <UiText size="tiny" span class="section-title">Доступ к филиалам</UiText>
        <div class="branch-checkboxes">
          <UiText size="small" class="all-branches-hint">Без выбора — доступ ко всем филиалам</UiText>
          <UiCheckbox
            v-for="branch in branches"
            :key="branch.id"
            :model-value="inviteBranchIds.includes(branch.id)"
            @update:model-value="toggleInviteBranch(branch.id, $event)"
          >
            {{ branch.name }}
          </UiCheckbox>
        </div>
      </template>

      <UiAlert v-if="inviteError" type="error">{{ inviteError }}</UiAlert>
    </UiForm>

    <!--  TODO: таблицы очень большие, в отдельный компонент  -->
    <!-- Участники -->
    <div>
      <UiText size="tiny" span class="section-title">Участники</UiText>

      <UiSkeleton v-if="teamLoading" text :repeat="3" />
      <UiDataTable
        v-else-if="members.length"
        :columns="memberColumns"
        :data="members"
        :row-key="(row: TenantMember) => row.id"
        :bordered="false"
        size="small"
        class="members-table"
      />
      <UiText v-else size="small">Пока нет участников</UiText>
    </div>

    <!-- Branch assignment modal -->
    <UiModal
      v-if="editingMemberBranches"
      :model-value="true"
      title="Доступ к филиалам"
      :width="400"
      @update:model-value="editingMemberBranches = null"
    >
      <div class="branch-modal">
        <UiText size="small" class="all-branches-hint">Без выбора — доступ ко всем филиалам</UiText>
        <div class="branch-checkboxes">
          <UiCheckbox
            v-for="branch in branches"
            :key="branch.id"
            :model-value="editingBranchIds.includes(branch.id)"
            @update:model-value="toggleEditBranch(branch.id, $event)"
          >
            {{ branch.name }}
          </UiCheckbox>
        </div>
        <div class="branch-modal-footer">
          <UiButton type="default" @click="editingMemberBranches = null">Отмена</UiButton>
          <UiButton type="primary" :loading="savingBranches" @click="saveBranchAssignment">Сохранить</UiButton>
        </div>
      </div>
    </UiModal>

    <!-- Pending инвайты -->
    <div v-if="invitations.length">
      <UiText size="tiny" span class="section-title">Ожидают принятия</UiText>
      <UiDataTable
        :columns="inviteColumns"
        :data="invitations"
        :row-key="(row: TenantInvitation) => row.id"
        :bordered="false"
        size="large"
        class="members-table"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
import { useNuxtApp } from '#imports'
import {
  UiInput, UiSelect, UiButton, UiAlert, UiTag, UiText, UiModal, UiCheckbox,
  UiSpace, UiSkeleton, UiMenuDropdown, UiDataTable, UiForm, useConfirm, useMessage,
} from '@fastio/ui'
import type { UiMenuDropdownItem, DataTableColumns } from '@fastio/ui'
import type { TenantRole, TenantMember, TenantInvitation } from '@fastio/shared'
import { useTeam } from '~/composables/useTeam'
import { usePermissions } from '~/composables/usePermissions'
import { useBranchStore } from '~/stores/branch'
import { membersApi } from '~/utils/api/members'
import { roleLabels, roleOptions, roleTagTypes } from '~/config/team-roles'
import { formatDate } from '~/utils/formatDate'

const { $supabase } = useNuxtApp()
const { members, invitations, loading: teamLoading, load, invite, changeRole, removeMember, cancelInvite } = useTeam()
const { canManageTeam } = usePermissions()
const { confirm } = useConfirm()
const message = useMessage()
const branchStore = useBranchStore()
const branches = computed(() => branchStore.branches)

const inviteFormRef = ref()
const inviteEmail = ref('')
const inviteRole = ref<TenantRole>('staff')
const inviting = ref(false)
const inviteError = ref('')
const inviteBranchIds = ref<string[]>([])

const toggleInviteBranch = (id: string, checked: boolean) => {
  if (checked) {
    if (!inviteBranchIds.value.includes(id)) inviteBranchIds.value.push(id)
  } else {
    inviteBranchIds.value = inviteBranchIds.value.filter((b) => b !== id)
  }
}

// Branch assignment per member
const editingMemberBranches = ref<TenantMember | null>(null)
const editingBranchIds = ref<string[]>([])
const savingBranches = ref(false)

const openBranchEdit = (member: TenantMember) => {
  editingMemberBranches.value = member
  editingBranchIds.value = [...(member.branchIds ?? [])]
}

const toggleEditBranch = (id: string, checked: boolean) => {
  if (checked) {
    if (!editingBranchIds.value.includes(id)) editingBranchIds.value.push(id)
  } else {
    editingBranchIds.value = editingBranchIds.value.filter((b) => b !== id)
  }
}

const saveBranchAssignment = async () => {
  if (!editingMemberBranches.value) return

  savingBranches.value = true
  try {
    await membersApi.updateBranchIds($supabase, editingMemberBranches.value.id, editingBranchIds.value)
    await load()
    editingMemberBranches.value = null
  } finally {
    savingBranches.value = false
  }
}

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
    await changeRole(member.id, roleName as TenantRole)
  }
}

// TODO: мы реально можем только через рендер функции создавать таблицу?
const memberColumns = computed<DataTableColumns<TenantMember>>(() => {
  const cols: DataTableColumns<TenantMember> = [
    {
      title: 'Участник',
      key: 'member',
      render: (row) => h('div', { class: 'member-cell' }, [
        h(UiText, { size: 'medium', class: 'member-name' }, () => row.displayName || row.email || '—'),
        row.displayName && row.email
          ? h(UiText, { size: 'tiny', class: 'member-email' }, () => row.email!)
          : null,
      ]),
    },
    {
      title: 'Роль',
      key: 'role',
      width: 110,
      render: (row) => h(UiTag, { type: roleTagType(row.role), size: 'small' }, () => roleLabel(row.role)),
    },
    {
      title: 'Добавлен',
      key: 'createdAt',
      width: 130,
      render: (row) => h(UiText, { size: 'small', class: 'hint-cell' }, () => formatDate(row.createdAt)),
    },
    {
      title: '',
      key: 'actions',
      width: 200,
      render: (row) => {
        if (row.role === 'owner' || !canManageTeam.value) return null

        return h(UiSpace, { size: 4 }, () => [
          h(
            UiMenuDropdown,
            { items: getRoleMenuItems(row), onItemClick: (name: string) => handleRoleMenuClick(row, name) },
            { trigger: () => h(UiButton, { type: 'text', size: 'small', icon: 'settings' }, () => 'Роль') },
          ),
          ...(branches.value.length > 0 && row.role !== 'admin'
            ? [h(UiButton, { type: 'text', size: 'small', onClick: () => openBranchEdit(row) }, () => 'Филиалы')]
            : []),
          h(UiButton, { type: 'text', size: 'small', onClick: () => handleRemove(row) }, () => 'Удалить'),
        ])
      },
    },
  ]

  if (branches.value.length > 0) {
    cols.splice(2, 0, {
      title: 'Филиалы',
      key: 'branches',
      render: (row) => {
        if (!row.branchIds?.length)
          return h(UiText, { size: 'small', class: 'hint-cell' }, () => 'Все')

        const names = branches.value
          .filter((b) => row.branchIds.includes(b.id))
          .map((b) => b.name)
          .join(', ')

        return h(UiText, { size: 'small' }, () => names)
      },
    })
  }

  return cols
})

const inviteColumns = computed<DataTableColumns<TenantInvitation>>(() => [
  {
    title: 'Email',
    key: 'email',
    render: (row) => h(UiText, { size: 'medium' }, () => row.email),
  },
  {
    title: 'Роль',
    key: 'role',
    width: 110,
    render: (row) => h(UiTag, { type: roleTagType(row.role), size: 'small' }, () => roleLabel(row.role)),
  },
  {
    title: 'Истекает',
    key: 'expiresAt',
    width: 130,
    render: (row) => h(UiText, { size: 'small', class: 'hint-cell' }, () => formatDate(row.expiresAt)),
  },
  {
    title: '',
    key: 'actions',
    width: 120,
    render: (row) => canManageTeam.value
      ? h(UiButton, { type: 'text', size: 'small', onClick: () => handleCancelInvite(row) }, () => 'Отменить')
      : null,
  },
])

const handleInvite = async () => {
  if (!inviteFormRef.value?.validate()) return

  inviting.value = true
  inviteError.value = ''

  const { error } = await invite(inviteEmail.value, inviteRole.value) ?? {}

  if (error) {
    inviteError.value = 'Не удалось отправить приглашение'
  } else {
    inviteEmail.value = ''
    inviteBranchIds.value = []
    message.success('Приглашение отправлено')
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

  if (confirmed) await removeMember(member.id)
}

const handleCancelInvite = async (inv: TenantInvitation) => {
  const confirmed = await confirm({
    title: 'Отменить приглашение',
    message: `Приглашение для ${inv.email} будет отменено`,
    confirmText: 'Отменить приглашение',
    confirmType: 'error',
  })

  if (confirmed) await cancelInvite(inv.id)
}

onMounted(() => load())
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

.members-table {
  margin-top: 4px;
}

.member-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-weight: 600;
}

.member-email,
.hint-cell {
  color: var(--color-text-tertiary);
}

.branch-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.all-branches-hint {
  color: var(--color-text-tertiary);
  padding-bottom: 4px;
}

.branch-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.branch-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}
</style>
