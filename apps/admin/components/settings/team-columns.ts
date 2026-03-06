import { h, type ComputedRef } from 'vue'
import { UiTag, UiText, UiButton, UiSpace, UiMenuDropdown } from '@fastio/ui'
import type { UiMenuDropdownItem, DataTableColumns } from '@fastio/ui'
import type { TenantRole, TenantMember, TenantInvitation, Branch } from '@fastio/shared'
import { roleLabels, roleTagTypes } from '~/config/team-roles'
import { formatDate } from '~/utils/formatDate'

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

type MemberColumnsDeps = {
  branches: ComputedRef<Branch[]>
  canManageTeam: ComputedRef<boolean>
  onRoleChange: (member: TenantMember, role: string) => void
  onBranchEdit: (member: TenantMember) => void
  onRemove: (member: TenantMember) => void
}

export const buildMemberColumns = (deps: MemberColumnsDeps): DataTableColumns<TenantMember> => {
  const { branches, canManageTeam, onRoleChange, onBranchEdit, onRemove } = deps

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
            { items: getRoleMenuItems(row), onItemClick: (name: string) => onRoleChange(row, name) },
            { trigger: () => h(UiButton, { type: 'text', size: 'small', icon: 'settings' }, () => 'Роль') },
          ),
          ...(branches.value.length > 0 && row.role !== 'admin'
            ? [h(UiButton, { type: 'text', size: 'small', onClick: () => onBranchEdit(row) }, () => 'Филиалы')]
            : []),
          h(UiButton, { type: 'text', size: 'small', onClick: () => onRemove(row) }, () => 'Удалить'),
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
}

type InviteColumnsDeps = {
  canManageTeam: ComputedRef<boolean>
  onCancel: (inv: TenantInvitation) => void
}

export const buildInviteColumns = (deps: InviteColumnsDeps): DataTableColumns<TenantInvitation> => [
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
    render: (row) => deps.canManageTeam.value
      ? h(UiButton, { type: 'text', size: 'small', onClick: () => deps.onCancel(row) }, () => 'Отменить')
      : null,
  },
]
