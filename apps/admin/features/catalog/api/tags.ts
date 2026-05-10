import type { SupabaseClient } from '@supabase/supabase-js'
import type { DishTagDefinition } from '@fastio/shared'
import { query } from '~/shared/utils/query'

export type TagFormData = {
  name: string
  icon: string
  color: string
}

type TagRow = {
  id: string
  tenant_id: string
  name: string
  icon: string
  color: string
  sort_order: number
  created_at: string
}

const mapTag = (raw: Record<string, unknown>): DishTagDefinition => {
  const row = raw as TagRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
  }
}

export const tagsApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<DishTagDefinition[]> {
    const data = await query(
      sb.from('dish_tags').select('*').eq('tenant_id', tenantId).order('sort_order'),
    )

    return (data ?? []).map(mapTag)
  },

  async add(sb: SupabaseClient, tenantId: string, data: TagFormData): Promise<DishTagDefinition | null> {
    const maxData = await query(
      sb.from('dish_tags').select('sort_order').eq('tenant_id', tenantId).order('sort_order', { ascending: false }).limit(1),
    )
    const maxOrder = (maxData as Array<{ sort_order: number }> | null)?.[0]?.sort_order ?? -1

    const result = await query(
      sb.from('dish_tags').insert({
        tenant_id: tenantId,
        name: data.name,
        icon: data.icon,
        color: data.color,
        sort_order: maxOrder + 1,
      }).select().single(),
    )

    return result ? mapTag(result) : null
  },

  async update(sb: SupabaseClient, id: string, data: Partial<TagFormData>): Promise<DishTagDefinition | null> {
    const payload: Record<string, unknown> = {}

    if (data.name !== undefined) payload.name = data.name
    if (data.icon !== undefined) payload.icon = data.icon
    if (data.color !== undefined) payload.color = data.color

    const result = await query(sb.from('dish_tags').update(payload).eq('id', id).select().single())

    return result ? mapTag(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('dish_tags').delete().eq('id', id))
  },

  async reorder(sb: SupabaseClient, items: { id: string; order: number }[]): Promise<void> {
    await Promise.all(
      items.map(({ id, order }) => query(sb.from('dish_tags').update({ sort_order: order }).eq('id', id))),
    )
  },

  async getAssignedTagIds(sb: SupabaseClient, dishId: string): Promise<string[]> {
    const data = await query(
      sb.from('dish_tag_assignments').select('tag_id').eq('dish_id', dishId),
    )

    return (data ?? []).map((r: Record<string, unknown>) => r.tag_id as string)
  },

  async setDishTags(sb: SupabaseClient, dishId: string, tenantId: string, tagIds: string[]): Promise<void> {
    const current = await tagsApi.getAssignedTagIds(sb, dishId)
    const toAdd = tagIds.filter((id) => !current.includes(id))
    const toRemove = current.filter((id) => !tagIds.includes(id))

    await Promise.all([
      toRemove.length > 0
        ? query(sb.from('dish_tag_assignments').delete().eq('dish_id', dishId).in('tag_id', toRemove))
        : Promise.resolve(),
      toAdd.length > 0
        ? query(sb.from('dish_tag_assignments').insert(toAdd.map((tagId) => ({ dish_id: dishId, tag_id: tagId, tenant_id: tenantId }))))
        : Promise.resolve(),
    ])
  },

  async getComboTagIds(sb: SupabaseClient, comboId: string): Promise<string[]> {
    const data = await query(
      sb.from('combo_tag_assignments').select('tag_id').eq('combo_id', comboId),
    )

    return (data ?? []).map((r: Record<string, unknown>) => r.tag_id as string)
  },

  async setComboTags(sb: SupabaseClient, comboId: string, tenantId: string, tagIds: string[]): Promise<void> {
    const current = await tagsApi.getComboTagIds(sb, comboId)
    const toAdd = tagIds.filter((id) => !current.includes(id))
    const toRemove = current.filter((id) => !tagIds.includes(id))

    await Promise.all([
      toRemove.length > 0
        ? query(sb.from('combo_tag_assignments').delete().eq('combo_id', comboId).in('tag_id', toRemove))
        : Promise.resolve(),
      toAdd.length > 0
        ? query(sb.from('combo_tag_assignments').insert(toAdd.map((tagId) => ({ combo_id: comboId, tag_id: tagId, tenant_id: tenantId }))))
        : Promise.resolve(),
    ])
  },

  async countsByTag(sb: SupabaseClient, tenantId: string): Promise<Record<string, number>> {
    const data = await query(
      sb.from('dish_tag_assignments').select('tag_id').eq('tenant_id', tenantId),
    )
    const counts: Record<string, number> = {}

    ;(data ?? []).forEach((row: Record<string, unknown>) => {
      const tagId = row.tag_id as string

      counts[tagId] = (counts[tagId] ?? 0) + 1
    })

    return counts
  },

  async listDishIdsByTag(sb: SupabaseClient, tenantId: string, tagId: string): Promise<string[]> {
    const data = await query(
      sb.from('dish_tag_assignments').select('dish_id').eq('tenant_id', tenantId).eq('tag_id', tagId).order('sort_order'),
    )

    return (data ?? []).map((r: Record<string, unknown>) => r.dish_id as string)
  },

  async reorderByTag(sb: SupabaseClient, tenantId: string, tagId: string, items: { id: string; order: number }[]): Promise<void> {
    await Promise.all(
      items.map(({ id, order }) => query(sb.from('dish_tag_assignments').update({ sort_order: order }).eq('tenant_id', tenantId).eq('tag_id', tagId).eq('dish_id', id)),
      ),
    )
  },
}
