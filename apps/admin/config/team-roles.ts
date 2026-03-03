import type { TenantRole } from '@fastio/shared'

export const roleLabels: Record<TenantRole, string> = {
  owner: 'Владелец',
  admin: 'Админ',
  manager: 'Менеджер',
  staff: 'Сотрудник',
}

export const roleOptions = [
  { value: 'admin', label: 'Админ' },
  { value: 'manager', label: 'Менеджер' },
  { value: 'staff', label: 'Сотрудник' },
]

export const roleTagTypes: Record<TenantRole, 'warning' | 'primary' | 'success' | 'default'> = {
  owner: 'warning',
  admin: 'primary',
  manager: 'success',
  staff: 'default',
}
