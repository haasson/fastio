import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModifierGroup, ModifierGroupFormData, ModifierOption } from '@fastio/shared'
import { query } from '~/utils/query'

type ModifierGroupRow = {
  id: string
  tenant_id: string
  name: string
  sort_order: number
  active: boolean
  deleted_at: string | null
  created_at: string
  modifier_options: ModifierOptionRow[]
}

type ModifierOptionRow = {
  id: string
  group_id: string
  name: string
  sort_order: number
  active: boolean
}

export const mapModifierOption = (row: ModifierOptionRow): ModifierOption => ({
  id: row.id,
  groupId: row.group_id,
  name: row.name,
  sortOrder: row.sort_order,
  active: row.active,
})

export const mapModifierGroup = (raw: Record<string, unknown>): ModifierGroup => {
  const row = raw as ModifierGroupRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    sortOrder: row.sort_order,
    active: row.active,
    options: (row.modifier_options ?? []).map(mapModifierOption),
  }
}

export const modifiersApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<ModifierGroup[]> {
    const data = await query(
      sb.from('modifier_groups')
        .select('*, modifier_options(*)')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('sort_order')
        .order('sort_order', { referencedTable: 'modifier_options' }),
    )

    return (data ?? []).map(mapModifierGroup)
  },

  async add(sb: SupabaseClient, tenantId: string, data: ModifierGroupFormData): Promise<ModifierGroup | null> {
    const result = await query(
      sb.from('modifier_groups')
        .insert({ tenant_id: tenantId, name: data.name, active: data.active })
        .select('*, modifier_options(*)')
        .single(),
    )

    if (!result) return null

    const group = mapModifierGroup(result)

    if (data.options.length > 0) {
      await query(
        sb.from('modifier_options').insert(
          data.options.map((opt, i) => ({
            group_id: group.id,
            name: opt.name,
            sort_order: i,
            active: opt.active,
          })),
        ),
      )

      // re-fetch with options
      const refreshed = await query(
        sb.from('modifier_groups')
          .select('*, modifier_options(*)')
          .eq('id', group.id)
          .order('sort_order', { referencedTable: 'modifier_options' })
          .single(),
      )

      return refreshed ? mapModifierGroup(refreshed) : group
    }

    return group
  },

  async update(sb: SupabaseClient, id: string, data: ModifierGroupFormData): Promise<ModifierGroup | null> {
    await query(
      sb.from('modifier_groups')
        .update({ name: data.name, active: data.active })
        .eq('id', id),
    )

    // Sync options: upsert existing + insert new + delete removed
    const existingOptions = await query(
      sb.from('modifier_options').select('id').eq('group_id', id),
    ) as { id: string }[]

    const existingIds = new Set((existingOptions ?? []).map((o) => o.id))
    const incomingIds = new Set(data.options.filter((o) => o.id).map((o) => o.id!))

    // Delete removed options
    const toDelete = [...existingIds].filter((eid) => !incomingIds.has(eid))

    if (toDelete.length > 0) {
      await query(sb.from('modifier_options').delete().in('id', toDelete))
    }

    // Upsert existing + insert new
    const toUpsert = data.options.map((opt, i) => ({
      ...(opt.id && existingIds.has(opt.id) ? { id: opt.id } : {}),
      group_id: id,
      name: opt.name,
      sort_order: i,
      active: opt.active,
    }))

    if (toUpsert.length > 0) {
      await query(
        sb.from('modifier_options')
          .upsert(toUpsert, { onConflict: 'id' }),
      )
    }

    // Re-fetch
    const refreshed = await query(
      sb.from('modifier_groups')
        .select('*, modifier_options(*)')
        .eq('id', id)
        .order('sort_order', { referencedTable: 'modifier_options' })
        .single(),
    )

    return refreshed ? mapModifierGroup(refreshed) : null
  },

  async remove(sb: SupabaseClient, id: string) {
    await query(
      sb.from('modifier_groups')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id),
    )
  },

  async toggleActive(sb: SupabaseClient, id: string, active: boolean) {
    await query(
      sb.from('modifier_groups').update({ active }).eq('id', id),
    )
  },
}
