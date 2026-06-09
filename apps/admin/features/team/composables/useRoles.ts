import { ref, type Ref } from 'vue'
import type { TenantCustomRole, RolePermissions } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'

export const useRoles = (tenantId: Ref<string | null>) => {
  const api = useDatabase()
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

    return role
  }

  const update = async (roleId: string, data: { name?: string; permissions?: RolePermissions }) => {
    await api.roles.update(roleId, data)
    await load()
  }

  const remove = async (roleId: string) => {
    await api.roles.remove(roleId)
    roles.value = roles.value.filter((r) => r.id !== roleId)
  }

  const getRoleById = (id: string | null) => {
    if (!id) return null

    return roles.value.find((r) => r.id === id) ?? null
  }

  return { roles, loading, load, create, update, remove, getRoleById }
}
