import type { SupabaseClient } from '@supabase/supabase-js'
import type { Category } from '@fastio/shared'

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    name: row.name as string,
    order: row.sort_order as number,
    active: row.active as boolean,
  }
}

export const categoriesApi = {
  async list(sb: SupabaseClient, tenantId: string) {
    const data = await query(sb.from('categories').select('*').eq('tenant_id', tenantId).order('sort_order'))
    return (data ?? []).map(mapCategory)
  },

  async add(sb: SupabaseClient, tenantId: string, payload: { name: string; order: number }) {
    await query(sb.from('categories').insert({
      tenant_id: tenantId,
      name: payload.name,
      sort_order: payload.order,
      active: true,
    }))
  },

  async update(sb: SupabaseClient, id: string, data: Partial<Pick<Category, 'name' | 'active' | 'order'>>) {
    await query(sb.from('categories').update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.active !== undefined && { active: data.active }),
      ...(data.order !== undefined && { sort_order: data.order }),
    }).eq('id', id))
  },

  async remove(sb: SupabaseClient, id: string) {
    await query(sb.from('categories').delete().eq('id', id))
  },
}
