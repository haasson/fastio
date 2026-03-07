import { h, type ComputedRef } from 'vue'
import { UiTag, UiText, UiButton, UiSpace } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { TenantRole, TenantMember, TenantInvitation, Branch } from '@fastio/shared'
import { roleLabels, roleTagTypes } from '~/config/team-roles'
import { formatDate } from '~/utils/formatDate'

const roleLabel = (role: TenantRole) => roleLabels[role]
const roleTagType = (role: TenantRole) => roleTagTypes[role]

const isBlocked = (row: TenantMember) => !!row.blockedUntil && new Date(row.blockedUntil) > new Date()

type MemberColumnsDeps = {
  branches: ComputedRef<Branch[]>
  canManageTeam: ComputedRef<boolean>
  onEdit: (member: TenantMember) => void
  onBlock: (member: TenantMember) => void
  onRemove: (member: TenantMember) => void
}

export const buildMemberColumns = (deps: MemberColumnsDeps): DataTableColumns<TenantMember> => {
  const { branches, canManageTeam, onEdit, onBlock, onRemove } = deps

  const cols: DataTableColumns<TenantMember> = [
    {
      title: 'Участник',
      key: 'member',
      width: 280,
      render: (row) => h('div', { class: 'member-cell' }, [
        h(UiText, { size: 'tiny', class: 'member-name' }, () => row.displayName || row.email || '—'),
        row.displayName && row.email && row.displayName !== row.email
          ? h(UiText, { size: 'tiny', class: 'member-email' }, () => row.email!)
          : null,
        row.invitedBy
          ? h(UiText, { size: 'tiny', class: 'member-invited-by' }, () => `Пригласил: ${row.invitedBy}`)
          : null,
      ]),
    },
    {
      title: 'Роль',
      key: 'role',
      width: 120,
      render: (row) => isBlocked(row)
        ? h(UiTag, { type: 'error', size: 'small' }, () => 'Заблокирован')
        : h(UiTag, { type: roleTagType(row.role), size: 'small' }, () => roleLabel(row.role)),
    },
    {
      title: 'Добавлен',
      key: 'createdAt',
      width: 130,
      render: (row) => h(UiText, { size: 'tiny', class: 'hint-cell' }, () => formatDate(row.createdAt)),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 130,
      render: (row) => {
        if (row.role === 'owner' || !canManageTeam.value) return null

        return h(UiSpace, { size: 8 }, () => [
          h(UiButton, { type: 'text', size: 'medium', icon: 'pencil', iconBg: '#3b82f6', onClick: () => onEdit(row) }),
          h(UiButton, { type: 'text', size: 'medium', icon: isBlocked(row) ? 'checkRound' : 'ban', iconBg: isBlocked(row) ? '#22c55e' : '#f59e0b', onClick: () => onBlock(row) }),
          h(UiButton, { type: 'text', size: 'medium', icon: 'trash', iconBg: '#ef4444', onClick: () => onRemove(row) }),
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
          return h(UiText, { size: 'tiny', class: 'hint-cell' }, () => 'Все')

        const names = branches.value
          .filter((b) => row.branchIds.includes(b.id))
          .map((b) => b.name)
          .join(', ')

        return h(UiText, { size: 'tiny' }, () => names)
      },
    })
  }

  return cols
}

type InviteColumnsDeps = {
  branches: ComputedRef<Branch[]>
  canManageTeam: ComputedRef<boolean>
  onResend: (inv: TenantInvitation) => void
  onCancel: (inv: TenantInvitation) => void
}

export const buildInviteColumns = (deps: InviteColumnsDeps): DataTableColumns<TenantInvitation> => {
  const { branches, canManageTeam, onResend, onCancel } = deps

  const cols: DataTableColumns<TenantInvitation> = [
    {
      title: 'Участник',
      key: 'email',
      width: 280,
      render: (row) => h(UiText, { size: 'tiny' }, () => row.email),
    },
    {
      title: 'Роль',
      key: 'role',
      width: 120,
      render: (row) => h(UiTag, { type: roleTagType(row.role), size: 'small' }, () => roleLabel(row.role)),
    },
    {
      title: 'Истекает',
      key: 'expiresAt',
      width: 130,
      render: (row) => h(UiText, { size: 'tiny' }, () => formatDate(row.expiresAt)),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 130,
      render: (row) => {
        if (!canManageTeam.value) return null

        return h(UiSpace, { size: 8 }, () => [
          h(UiButton, { type: 'text', size: 'medium', icon: 'send', iconBg: '#3b82f6', onClick: () => onResend(row) }),
          h(UiButton, { type: 'text', size: 'medium', icon: 'trash', iconBg: '#ef4444', onClick: () => onCancel(row) }),
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
          return h(UiText, { size: 'tiny', class: 'hint-cell' }, () => 'Все')

        const names = branches.value
          .filter((b) => row.branchIds.includes(b.id))
          .map((b) => b.name)
          .join(', ')

        return h(UiText, { size: 'tiny' }, () => names)
      },
    })
  }

  return cols
}
