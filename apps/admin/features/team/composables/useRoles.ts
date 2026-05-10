import { ref, type Ref } from 'vue'
import type { TenantCustomRole, RolePermissions } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useAuditLog } from '~/features/audit-log'

export const useRoles = (tenantId: Ref<string | null>) => {
  const api = useDatabase()
  const { log } = useAuditLog()
  const roles = ref<TenantCustomRole[]>([])
  const loading = ref(false)

  const load = async () => {
    if (!tenantId.value) return
    loading.value = true
    try {
      roles.value = await api.roles.list(tenantId.value)
    } finally {
      loading.value = false
    }
  }

  const create = async (name: string, permissions: RolePermissions) => {
    if (!tenantId.value) return
    const role = await api.roles.create(tenantId.value, name, permissions)

    roles.value.push(role)
    log({
      action: 'role.create',
      entityType: 'role',
      entityId: role.id,
      entityName: role.name,
      payload: { permissions },
    })

    return role
  }

  const update = async (roleId: string, data: { name?: string; permissions?: RolePermissions }) => {
    const before = roles.value.find((r) => r.id === roleId)

    await api.roles.update(roleId, data)
    log({
      action: 'role.update',
      entityType: 'role',
      entityId: roleId,
      entityName: data.name ?? before?.name ?? null,
      payload: { oldName: before?.name ?? null, oldPermissions: before?.permissions ?? null, ...data },
    })
    await load()
  }

  const remove = async (roleId: string) => {
    const role = roles.value.find((r) => r.id === roleId)

    await api.roles.remove(roleId)
    roles.value = roles.value.filter((r) => r.id !== roleId)
    log({
      action: 'role.delete',
      entityType: 'role',
      entityId: roleId,
      entityName: role?.name ?? null,
      payload: { permissions: role?.permissions ?? null },
    })
  }

  const getRoleById = (id: string | null) => {
    if (!id) return null

    return roles.value.find((r) => r.id === id) ?? null
  }

  return { roles, loading, load, create, update, remove, getRoleById }
}
