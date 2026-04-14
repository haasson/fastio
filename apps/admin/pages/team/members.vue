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
          v-model:value="inviteRoleId"
          label="Роль"
          :options="roleSelectOptions"
          :rules="[{ type: 'required', message: 'Выберите роль' }]"
          style="min-width: 160px"
        />
      </UiSpace>

      <template v-if="branches.length > 0">
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

    <TeamMemberEditModal
      v-model="showEditModal"
      :member="editingMember"
      :branches="branches"
      @saved="load"
    />

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
import { ref, computed, onMounted, watch } from 'vue'
import {
  UiInput, UiSelect, UiButton, UiAlert, UiText,
  UiSpace, UiSkeleton, UiDataTable, UiForm, UiRadioGroup, UiCheckbox, useConfirm, useMessage, UiSectionHeader,
} from '@fastio/ui'
import type { TenantMember, TenantInvitation } from '@fastio/shared'
import TeamMemberEditModal from '~/components/settings/TeamMemberEditModal.vue'
import { useTeam } from '~/composables/data/useTeam'
import { usePermissions } from '~/composables/auth/usePermissions'
import { useBranchStore } from '~/stores/branch'
import { useTenantStore } from '~/stores/tenant'
import { buildMemberColumns, buildInviteColumns } from '~/columns/team'

const { members, invitations, loading: teamLoading, load, invite, removeMember, blockMember, unblockMember, cancelInvite, resendInvite } = useTeam()
const { canManageTeam } = usePermissions()
const { confirm } = useConfirm()
const message = useMessage()
const branchStore = useBranchStore()
const tenantStore = useTenantStore()
const branches = computed(() => branchStore.branches)

const roleSelectOptions = computed(() => tenantStore.roles.map((r) => ({ value: r.id, label: r.name })),
)

const inviteFormRef = ref()
const inviteEmail = ref('')
const inviteRoleId = ref<string | null>(null)
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
const showEditModal = ref(false)
const editingMember = ref<TenantMember | null>(null)

const openEdit = (member: TenantMember) => {
  editingMember.value = member
  showEditModal.value = true
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

  if (!inviteRoleId.value) {
    inviteError.value = 'Выберите роль'

    return
  }

  if (inviteBranchMode.value === 'selected' && inviteBranchIds.value.length === 0) {
    inviteError.value = 'Выберите хотя бы один филиал'

    return
  }

  inviting.value = true
  inviteError.value = ''

  try {
    const { error, message: errorMessage } = await invite(inviteEmail.value, inviteRoleId.value, inviteBranchIds.value) ?? {}

    if (error) {
      inviteError.value = errorMessage ?? 'Не удалось отправить приглашение'
    } else {
      inviteEmail.value = ''
      inviteBranchIds.value = []
      inviteBranchMode.value = 'all'
      message.success('Приглашение отправлено')
    }
  } finally {
    inviting.value = false
  }
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
@use '@fastio/styles/mixins/layout' as *;

.team-root {
  @include flex-col(var(--space-32));
}

.invite-form {
  @include flex-col(var(--space-12));
}

.members-table {
  margin-top: var(--space-4);

  :deep(.member-cell) {
    @include flex-col(var(--space-4));
  }

  :deep(.member-name) {
    font-weight: var(--font-weight-semibold);
  }

  :deep(.member-invited-by) {
    color: var(--color-text-secondary);
  }

}

.branch-checkboxes {
  @include flex-col;
}
</style>
