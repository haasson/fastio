import { h, type ComputedRef } from 'vue'
import { UiTag, UiText, UiButton, UiRowActions } from '@fastio/ui'
import type { DataTableColumns } from '@fastio/ui'
import type { TenantMember, TenantInvitation, Branch } from '@fastio/shared'
import { formatDate } from '@fastio/shared'

const isBlocked = (row: TenantMember) => !!row.blockedUntil && new Date(row.blockedUntil) > new Date()
const isOwner = (row: TenantMember) => row.roleId === null

type MemberColumnsDeps = {
  branches: ComputedRef<Branch[]>
  canManageTeam: ComputedRef<boolean>
  onEdit: (member: TenantMember) => void
  onBlock: (member: TenantMember) => void
  onRemove: (member: TenantMember) => void
}

export const buildMemberColumns = (deps: MemberColumnsDeps): DataTableColumns<TenantMember> => {
  const { branches, canManageTeam, onEdit, onBlock, onRemove } = deps

  const branchesCol: DataTableColumns<TenantMember>[number] = {
    title: 'Филиалы',
    key: 'branches',
    render: (row) => {
      if (!row.branchIds?.length)
        return h(UiText, { size: 'tiny', style: 'color: var(--color-text-secondary)' }, () => 'Все')

      const names = branches.value
        .filter((b) => row.branchIds.includes(b.id))
        .map((b) => b.name)
        .join(', ')

      return h(UiText, { size: 'tiny' }, () => names)
    },
  }

  return [
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
      render: (row) => {
        if (isBlocked(row)) return h(UiTag, { type: 'error', size: 'small' }, () => 'Заблокирован')
        if (isOwner(row)) return h(UiTag, { type: 'warning', size: 'small' }, () => 'Владелец')

        return h(UiTag, { type: 'primary', size: 'small' }, () => row.roleName ?? '—')
      },
    },
    branchesCol,
    {
      title: 'Добавлен',
      key: 'createdAt',
      width: 130,
      render: (row) => h(UiText, { size: 'tiny', style: 'color: var(--color-text-secondary)' }, () => formatDate(row.createdAt)),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 130,
      render: (row) => {
        if (isOwner(row) || !canManageTeam.value) return null

        const blocked = isBlocked(row)

        return h(UiRowActions, { onEdit: () => onEdit(row), onDelete: () => onRemove(row) }, {
          default: () => h(UiButton, { type: 'text', size: 'medium', icon: blocked ? 'checkRound' : 'ban', iconBg: blocked ? 'var(--color-success)' : 'var(--color-warning)', onClick: () => onBlock(row) }),
        })
      },
    },
  ]
}

type InviteColumnsDeps = {
  branches: ComputedRef<Branch[]>
  canManageTeam: ComputedRef<boolean>
  onResend: (inv: TenantInvitation) => void
  onCancel: (inv: TenantInvitation) => void
}

export const buildInviteColumns = (deps: InviteColumnsDeps): DataTableColumns<TenantInvitation> => {
  const { branches, canManageTeam, onResend, onCancel } = deps

  const branchesCol: DataTableColumns<TenantInvitation>[number] = {
    title: 'Филиалы',
    key: 'branches',
    render: (row) => {
      if (!row.branchIds?.length)
        return h(UiText, { size: 'tiny', style: 'color: var(--color-text-secondary)' }, () => 'Все')

      const names = branches.value
        .filter((b) => row.branchIds.includes(b.id))
        .map((b) => b.name)
        .join(', ')

      return h(UiText, { size: 'tiny' }, () => names)
    },
  }

  return [
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
      render: (row) => h(UiTag, { type: 'primary', size: 'small' }, () => row.roleName ?? '—'),
    },
    branchesCol,
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

        return h(UiRowActions, { showEdit: false, onDelete: () => onCancel(row) }, {
          default: () => h(UiButton, { type: 'text', size: 'medium', icon: 'send', iconBg: 'var(--color-primary)', onClick: () => onResend(row) }),
        })
      },
    },
  ]
}
