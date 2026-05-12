import type { SupabaseClient } from '@supabase/supabase-js'
import { query } from '~/shared/utils/query'

// TODO: вынеси тип в packages/shared/src/types/__FEATURE_CAMEL__.ts если он cross-package
export type __FEATURE_PASCAL__ = {
  id: string
  tenantId: string
  // TODO: поля
  createdAt: string
  updatedAt: string
}

export type __FEATURE_PASCAL__FormData = {
  // TODO: поля формы (без id/tenantId/timestamps)
}

const SELECT_FIELDS = `
  id, tenant_id,
  created_at, updated_at
`.trim()

const map = (row: Record<string, unknown>): __FEATURE_PASCAL__ => ({
  id: row.id as string,
  tenantId: row.tenant_id as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
})

export const __FEATURE_CAMEL__sApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<__FEATURE_PASCAL__[]> {
    const data = await query(
      sb.from('__TABLE__')
        .select(SELECT_FIELDS)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
    )
    return (data ?? []).map(map)
  },

  async getById(sb: SupabaseClient, id: string): Promise<__FEATURE_PASCAL__ | null> {
    const { data, error } = await sb
      .from('__TABLE__')
      .select(SELECT_FIELDS)
      .eq('id', id)
      .maybeSingle()
    if (error) {
      console.error('[__FEATURE_CAMEL__s.getById]', error.message)
      return null
    }
    return data ? map(data) : null
  },

  async create(sb: SupabaseClient, tenantId: string, data: __FEATURE_PASCAL__FormData): Promise<__FEATURE_PASCAL__ | null> {
    const result = await query(
      sb.from('__TABLE__')
        .insert({ tenant_id: tenantId, ...data })
        .select(SELECT_FIELDS)
        .single(),
    )
    return result ? map(result) : null
  },

  async update(sb: SupabaseClient, id: string, patch: Partial<__FEATURE_PASCAL__FormData>): Promise<__FEATURE_PASCAL__ | null> {
    const result = await query(
      sb.from('__TABLE__')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(SELECT_FIELDS)
        .single(),
    )
    return result ? map(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('__TABLE__').delete().eq('id', id))
  },
}
