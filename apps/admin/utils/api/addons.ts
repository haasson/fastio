import type { SupabaseClient } from '@supabase/supabase-js'
import type { Addon, AddonPreset } from '@fastio/shared'
import { query } from '~/utils/query'

type AddonRow = {
  id: string
  tenant_id: string
  name: string
  weight: number | null
  price: number
  active: boolean
  sort_order: number
  deleted_at: string | null
}

type AddonPresetRow = {
  id: string
  tenant_id: string
  name: string
  active: boolean
  deleted_at: string | null
  addon_preset_items: { addon_id: string; sort_order: number }[]
}

export const mapAddon = (raw: Record<string, unknown>): Addon => {
  const row = raw as AddonRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    weight: row.weight,
    price: Number(row.price),
    active: row.active,
    order: row.sort_order,
  }
}

export const mapAddonPreset = (raw: Record<string, unknown>): AddonPreset => {
  const row = raw as AddonPresetRow
  const items = (row.addon_preset_items ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => i.addon_id)

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    addonIds: items,
    active: row.active,
  }
}

export const addonsApi = {
  // ---- Addons ----

  async list(sb: SupabaseClient, tenantId: string): Promise<Addon[]> {
    const data = await query(
      sb.from('addons')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('sort_order'),
    )

    return (data ?? []).map(mapAddon)
  },

  async add(sb: SupabaseClient, tenantId: string, data: { name: string; weight: number | null; price: number }): Promise<Addon | null> {
    const result = await query(
      sb.from('addons')
        .insert({ tenant_id: tenantId, name: data.name, weight: data.weight, price: data.price })
        .select()
        .single(),
    )

    return result ? mapAddon(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<{ name: string; weight: number | null; price: number; active: boolean; order: number }>): Promise<Addon | null> {
    const patch: Record<string, unknown> = {}

    if (data.name !== undefined) patch.name = data.name
    if (data.weight !== undefined) patch.weight = data.weight
    if (data.price !== undefined) patch.price = data.price
    if (data.active !== undefined) patch.active = data.active
    if (data.order !== undefined) patch.sort_order = data.order

    const result = await query(
      sb.from('addons').update(patch).eq('id', id).select().single(),
    )

    return result ? mapAddon(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(
      sb.from('addons').update({ deleted_at: new Date().toISOString() }).eq('id', id),
    )
  },

  async toggleActive(sb: SupabaseClient, id: string, active: boolean): Promise<void> {
    await query(sb.from('addons').update({ active }).eq('id', id))
  },

  // ---- Presets ----

  async listPresets(sb: SupabaseClient, tenantId: string): Promise<AddonPreset[]> {
    const data = await query(
      sb.from('addon_presets')
        .select('*, addon_preset_items(addon_id, sort_order)')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('name'),
    )

    return (data ?? []).map(mapAddonPreset)
  },

  async addPreset(sb: SupabaseClient, tenantId: string, name: string, addonIds: string[]): Promise<AddonPreset | null> {
    const result = await query(
      sb.from('addon_presets')
        .insert({ tenant_id: tenantId, name })
        .select()
        .single(),
    )

    if (!result) return null

    const presetId = (result as { id: string }).id

    if (addonIds.length > 0) {
      await query(
        sb.from('addon_preset_items').insert(
          addonIds.map((addon_id, i) => ({ preset_id: presetId, addon_id, sort_order: i })),
        ),
      )
    }

    const refreshed = await query(
      sb.from('addon_presets')
        .select('*, addon_preset_items(addon_id, sort_order)')
        .eq('id', presetId)
        .single(),
    )

    return refreshed ? mapAddonPreset(refreshed) : null
  },

  async updatePreset(sb: SupabaseClient, id: string, name: string, addonIds: string[]): Promise<void> {
    await query(sb.from('addon_presets').update({ name }).eq('id', id))

    await query(sb.from('addon_preset_items').delete().eq('preset_id', id))

    if (addonIds.length > 0) {
      await query(
        sb.from('addon_preset_items').insert(
          addonIds.map((addon_id, i) => ({ preset_id: id, addon_id, sort_order: i })),
        ),
      )
    }
  },

  async removePreset(sb: SupabaseClient, id: string): Promise<void> {
    await query(
      sb.from('addon_presets').update({ deleted_at: new Date().toISOString() }).eq('id', id),
    )
  },

  // ---- Dish addons ----

  async getDishAddons(sb: SupabaseClient, dishId: string): Promise<string[]> {
    const data = await query(
      sb.from('dish_addons')
        .select('addon_id, sort_order')
        .eq('dish_id', dishId)
        .order('sort_order'),
    )

    return (data ?? []).map((r) => r.addon_id)
  },

  async setDishAddons(sb: SupabaseClient, dishId: string, addonIds: string[]): Promise<void> {
    await query(sb.from('dish_addons').delete().eq('dish_id', dishId))

    if (addonIds.length === 0) return

    await query(
      sb.from('dish_addons').insert(
        addonIds.map((addon_id, i) => ({ dish_id: dishId, addon_id, sort_order: i })),
      ),
    )
  },
}
