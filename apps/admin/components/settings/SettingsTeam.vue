<template>
  <div class="team-root">
    <!-- Форма инвайта -->
    <UiForm ref="inviteFormRef" class="invite-form">
      <UiSectionHeader title="Пригласить в команду" />
      <UiSpace :size="8" align="start">
        <UiInput
          v-model="inviteEmail"
          label="Email"
          name="email"
          placeholder="email@example.com"
          :clearable="false"
          :rules="[
            { type: 'required', message: 'Введите email' },
            { type: 'email', message: 'Некорректный email' },
          ]"
        />
        <UiSelect
          v-model:value="inviteRole"
          label="Роль"
          :options="roleOptions"
          :rules="[{ type: 'required', message: 'Выберите роль' }]"
          style="min-width: 160px"
        />
      </UiSpace>

      <template v-if="branches.length > 0 && inviteRole !== 'admin' && inviteRole !== 'owner'">
        <UiRadioGroup
          v-model="inviteBranchMode"
          label="Доступ к филиалам"
          :options="branchAccessOptions"
        />
        <div v-if="inviteBranchMode === 'selected'" class="branch-checkboxes">
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
      <div>
        <UiButton type="primary" :loading="inviting" @click="handleInvite">Пригласить</UiButton>
      </div>
    </UiForm>

    <!-- Участники -->
    <div>
      <UiSectionHeader title="Участники" />

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

    <!-- Edit modal -->
    <UiModal
      v-if="editingMember"
      :model-value="true"
      title="Редактировать участника"
      :width="400"
      :loading="savingEdit"
      :actions="[
        { text: 'Отмена', type: 'default', actionType: 'decline' },
        { text: 'Сохранить', type: 'primary', actionType: 'confirm' },
      ]"
      :on-confirm="saveEdit"
      @update:model-value="editingMember = null"
    >
      <div class="edit-modal">
        <UiSelect
          v-model:value="editForm.role"
          label="Роль"
          :options="roleOptions"
        />
        <template v-if="branches.length > 0 && editForm.role !== 'admin' && editForm.role !== 'owner'">
          <UiRadioGroup
            v-model="editBranchMode"
            label="Доступ к филиалам"
            :options="branchAccessOptions"
          />
          <div v-if="editBranchMode === 'selected'" class="branch-checkboxes">
            <UiCheckbox
              v-for="branch in branches"
              :key="branch.id"
              :model-value="editForm.branchIds.includes(branch.id)"
              @update:model-value="toggleEditBranch(branch.id, $event)"
            >
              {{ branch.name }}
            </UiCheckbox>
          </div>
        </template>
      </div>
    </UiModal>

    <!-- Pending инвайты -->
    <div v-if="invitations.length">
      <UiSectionHeader title="Ожидают принятия" />
      <UiDataTable
        :columns="inviteColumns"
        :data="invitations"
        :row-key="(row: TenantInvitation) => row.id"
        :bordered="false"
        size="small"
        class="members-table"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import {
  UiInput, UiSelect, UiButton, UiAlert, UiText, UiModal, UiCheckbox,
  UiSpace, UiSkeleton, UiDataTable, UiForm, UiRadioGroup, useConfirm, useMessage,
} from '@fastio/ui'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import type { TenantRole, TenantMember, TenantInvitation } from '@fastio/shared'
import { useTeam } from '~/composables/data/useTeam'
import { usePermissions } from '~/composables/auth/usePermissions'
import { useBranchStore } from '~/stores/branch'
import { roleOptions } from '~/config/team-roles'
import { buildMemberColumns, buildInviteColumns } from './team-columns'

const { members, invitations, loading: teamLoading, load, invite, updateRoleAndBranches, removeMember, blockMember, unblockMember, cancelInvite, resendInvite } = useTeam()
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
const inviteBranchMode = ref<'all' | 'selected'>('all')
const inviteBranchIds = ref<string[]>([])

const branchAccessOptions = [
  { label: 'Ко всем филиалам', value: 'all' },
  { label: 'К выбранным', value: 'selected' },
]

watch(inviteBranchMode, (mode) => {
  if (mode === 'all') inviteBranchIds.value = []
})

const toggleInviteBranch = (id: string, checked: boolean) => {
  if (checked) {
    if (!inviteBranchIds.value.includes(id)) inviteBranchIds.value.push(id)
  } else {
    inviteBranchIds.value = inviteBranchIds.value.filter((b) => b !== id)
  }
}

// Edit modal
const editingMember = ref<TenantMember | null>(null)
const editForm = reactive({ role: '' as TenantRole, branchIds: [] as string[] })
const editBranchMode = ref<'all' | 'selected'>('all')
const savingEdit = ref(false)

watch(editBranchMode, (mode) => {
  if (mode === 'all') editForm.branchIds = []
})

const openEdit = (member: TenantMember) => {
  editingMember.value = member
  editForm.role = member.role
  editForm.branchIds = [...(member.branchIds ?? [])]
  editBranchMode.value = editForm.branchIds.length > 0 ? 'selected' : 'all'
}

const toggleEditBranch = (id: string, checked: boolean) => {
  if (checked) {
    if (!editForm.branchIds.includes(id)) editForm.branchIds.push(id)
  } else {
    editForm.branchIds = editForm.branchIds.filter((b) => b !== id)
  }
}

const saveEdit = async () => {
  if (!editingMember.value) return
  savingEdit.value = true
  try {
    const branchIds = editBranchMode.value === 'all' ? [] : editForm.branchIds

    await updateRoleAndBranches(editingMember.value.id, editForm.role, branchIds)
    await load()
    editingMember.value = null
  } finally {
    savingEdit.value = false
  }
}

const isBlocked = (member: TenantMember) => !!member.blockedUntil && new Date(member.blockedUntil) > new Date()

const handleBlock = async (member: TenantMember) => {
  if (isBlocked(member)) {
    const confirmed = await confirm({
      title: 'Разблокировать участника',
      message: `${member.email ?? member.displayName} получит доступ обратно`,
      confirmText: 'Разблокировать',
    })

    if (confirmed) {
      await unblockMember(member.id)
      message.success('Участник разблокирован')
    }
  } else {
    const confirmed = await confirm({
      title: 'Заблокировать участника',
      message: `${member.email ?? member.displayName} потеряет доступ`,
      confirmText: 'Заблокировать',
      confirmType: 'error',
    })

    if (confirmed) {
      const forever = new Date(9999, 0).toISOString()

      await blockMember(member.id, forever)
      message.success('Участник заблокирован')
    }
  }
}

const memberColumns = computed(() => buildMemberColumns({
  branches,
  canManageTeam,
  onEdit: openEdit,
  onBlock: handleBlock,
  onRemove: handleRemove,
}))

const inviteColumns = computed(() => buildInviteColumns({
  branches,
  canManageTeam,
  onResend: handleResendInvite,
  onCancel: handleCancelInvite,
}))

const handleInvite = async () => {
  if (!inviteFormRef.value?.validate()) return

  if (inviteBranchMode.value === 'selected' && inviteBranchIds.value.length === 0) {
    inviteError.value = 'Выберите хотя бы один филиал'

    return
  }

  inviting.value = true
  inviteError.value = ''

  const { error, message: errorMessage } = await invite(inviteEmail.value, inviteRole.value, inviteBranchIds.value) ?? {}

  if (error) {
    inviteError.value = errorMessage ?? 'Не удалось отправить приглашение'
  } else {
    inviteEmail.value = ''
    inviteBranchIds.value = []
    inviteBranchMode.value = 'all'
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

const handleResendInvite = async (inv: TenantInvitation) => {
  const confirmed = await confirm({
    title: 'Переотправить приглашение',
    message: `Новое приглашение будет отправлено на ${inv.email}`,
    confirmText: 'Отправить',
  })

  if (confirmed) {
    await resendInvite(inv.id)
    message.success('Приглашение отправлено повторно')
  }
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
.team-root {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.invite-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.members-table {
  margin-top: 4px;

  :deep(.member-cell) {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  :deep(.member-name) {
    font-weight: 600;
  }

  :deep(.member-invited-by) {
    color: var(--color-text-tertiary);
  }

}

.branch-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
