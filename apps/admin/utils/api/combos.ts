import type { SupabaseClient } from '@supabase/supabase-js'
import type { Combo, ComboFormData, ComboBranchSetting, ComboItemInput } from '@fastio/shared'
import { query } from '~/utils/query'
import type { ComboRow, ComboBranchSettingRow } from './db-types'
import { optimizeImage } from '~/utils/imageOptimize'

export const mapCombo = (raw: Record<string, unknown>): Combo => {
  const row = raw as ComboRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    price: row.price,
    photos: row.photos ?? [],
    tags: [],
    active: row.active,
    order: row.sort_order,
  }
}

export const combosApi = {
  async listAllActive(sb: SupabaseClient, tenantId: string): Promise<Combo[]> {
    const data = await query(
      sb.from('combos').select('*').eq('tenant_id', tenantId).eq('active', true).order('sort_order'),
    )

    return (data ?? []).map(mapCombo)
  },

  async list(sb: SupabaseClient, tenantId: string, categoryId: string): Promise<Combo[]> {
    const data = await query(
      sb.from('combos').select('*').eq('tenant_id', tenantId).eq('category_id', categoryId).order('sort_order'),
    )

    return (data ?? []).map(mapCombo)
  },

  async add(sb: SupabaseClient, tenantId: string, categoryId: string, data: ComboFormData): Promise<Combo | null> {
    const maxOrderData = await query(
      sb.from('combos').select('sort_order').eq('category_id', categoryId).order('sort_order', { ascending: false }).limit(1),
    )
    const maxOrder = (maxOrderData as Array<{ sort_order: number }> | null)?.[0]?.sort_order ?? -1

    const result = await query(
      sb.from('combos').insert({
        tenant_id: tenantId,
        category_id: categoryId,
        name: data.name,
        description: data.description,
        price: data.price,
        photos: data.photos ?? [],
        active: data.active,
        sort_order: maxOrder + 1,
      }).select().single(),
    )

    if (!result) return null

    const combo = mapCombo(result)

    if (data.items.length > 0) {
      await query(
        sb.from('combo_items').insert(
          data.items.map((item, i) => ({
            combo_id: combo.id,
            dish_id: item.dishId,
            sort_order: i,
            modifier_option_ids: item.modifierOptionIds,
          })),
        ),
      )
    }

    return combo
  },

  async update(sb: SupabaseClient, id: string, data: Partial<ComboFormData>): Promise<Combo | null> {
    const updatePayload: Record<string, unknown> = {}

    if (data.name !== undefined) updatePayload.name = data.name
    if (data.description !== undefined) updatePayload.description = data.description
    if (data.price !== undefined) updatePayload.price = data.price
    if (data.photos !== undefined) updatePayload.photos = data.photos
    if (data.active !== undefined) updatePayload.active = data.active

    const result = await query(sb.from('combos').update(updatePayload).eq('id', id).select().single())

    if (!result) return null

    if (data.items !== undefined) {
      if (data.items.length > 0) {
        await query(
          sb.from('combo_items').upsert(
            data.items.map((item, i) => ({
              combo_id: id,
              dish_id: item.dishId,
              sort_order: i,
              modifier_option_ids: item.modifierOptionIds,
            })),
            { onConflict: 'combo_id,dish_id' },
          ),
        )
        const dishIds = data.items.map((item) => item.dishId)

        await query(
          sb.from('combo_items').delete().eq('combo_id', id).not('dish_id', 'in', `(${dishIds.join(',')})`),
        )
      } else {
        await query(sb.from('combo_items').delete().eq('combo_id', id))
      }
    }

    return mapCombo(result)
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('combos').delete().eq('id', id))
  },

  async toggleActive(sb: SupabaseClient, id: string, active: boolean): Promise<void> {
    await query(sb.from('combos').update({ active }).eq('id', id))
  },

  async reorder(sb: SupabaseClient, items: { id: string; order: number }[]): Promise<void> {
    await Promise.all(
      items.map(({ id, order }) => query(sb.from('combos').update({ sort_order: order }).eq('id', id))),
    )
  },

  async getItems(sb: SupabaseClient, comboId: string): Promise<ComboItemInput[]> {
    const data = await query(
      sb.from('combo_items').select('dish_id, modifier_option_ids').eq('combo_id', comboId).order('sort_order'),
    )

    return (data ?? []).map((row: Record<string, unknown>) => ({
      dishId: row.dish_id as string,
      modifierOptionIds: (row.modifier_option_ids as string[] | null) ?? [],
    }))
  },

  async countsByCategory(sb: SupabaseClient, tenantId: string): Promise<Record<string, number>> {
    const data = await query(sb.from('combos').select('category_id').eq('tenant_id', tenantId))
    const counts: Record<string, number> = {}

    ;(data ?? []).forEach((row: Record<string, unknown>) => {
      const cid = row.category_id as string

      counts[cid] = (counts[cid] ?? 0) + 1
    })

    return counts
  },

  async getBranchSettings(sb: SupabaseClient, comboId: string): Promise<ComboBranchSetting[]> {
    const data = await query(
      sb.from('combo_branch_settings').select('*').eq('combo_id', comboId),
    )

    return (data ?? []).map((raw: Record<string, unknown>): ComboBranchSetting => {
      const row = raw as ComboBranchSettingRow

      return { comboId: row.combo_id, branchId: row.branch_id, price: row.price, active: row.active }
    })
  },

  async setBranchSettings(
    sb: SupabaseClient,
    comboId: string,
    settings: { branchId: string; price: number | null; active: boolean | null }[],
  ): Promise<void> {
    await query(sb.from('combo_branch_settings').delete().eq('combo_id', comboId))

    const rows = settings.filter((s) => s.price != null || s.active === false)

    if (rows.length === 0) return

    await query(
      sb.from('combo_branch_settings').insert(
        rows.map((s) => ({ combo_id: comboId, branch_id: s.branchId, price: s.price, active: s.active })),
      ),
    )
  },

  async uploadPhoto(sb: SupabaseClient, tenantId: string, file: File): Promise<string> {
    const blob = await optimizeImage(file)
    const path = `${tenantId}/${crypto.randomUUID()}.webp`

    await query(sb.storage.from('dish-images').upload(path, blob, { contentType: 'image/webp' }))

    return sb.storage.from('dish-images').getPublicUrl(path).data.publicUrl
  },

  async deletePhoto(sb: SupabaseClient, url: string): Promise<void> {
    const marker = '/dish-images/'
    const idx = url.indexOf(marker)

    if (idx === -1) return

    const path = url.substring(idx + marker.length)

    await query(sb.storage.from('dish-images').remove([path]))
  },
}
