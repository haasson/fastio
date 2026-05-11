import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResourceUnavailability, ResourceUnavailabilityReason } from '@fastio/shared'
import { mapResourceUnavailability } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import type { ResourceUnavailabilityRow } from '~/shared/data/db-types'

export type ResourceUnavailabilityFormData = {
  resourceId: string
  dateFrom: string // YYYY-MM-DD
  dateTo: string // YYYY-MM-DD
  reason: ResourceUnavailabilityReason
  notes?: string | null
}

export const resourceUnavailabilityApi = {
  // Все периоды отсутствия для тенанта (для CRUD-страницы и списков фильтров).
  async list(sb: SupabaseClient, tenantId: string): Promise<ResourceUnavailability[]> {
    const data = await query(
      sb.from('resource_unavailability')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('date_from', { ascending: false }),
    )

    return (data ?? []).map((r) => mapResourceUnavailability(r as Record<string, unknown>))
  },

  // Периоды для одного ресурса. Опциональный `range` сужает выборку до периодов,
  // пересекающих диапазон дат (overlap: dateFrom <= range.to AND dateTo >= range.from).
  // Без range — все периоды (для секции «Отпуска и отсутствия» в drawer'е ресурса).
  async listForResource(
    sb: SupabaseClient,
    resourceId: string,
    range?: { from: string; to: string },
  ): Promise<ResourceUnavailability[]> {
    let q = sb.from('resource_unavailability')
      .select('*')
      .eq('resource_id', resourceId)
      .order('date_from', { ascending: false })

    if (range) {
      q = q.lte('date_from', range.to).gte('date_to', range.from)
    }

    const data = await query(q)

    return (data ?? []).map((r) => mapResourceUnavailability(r as Record<string, unknown>))
  },

  async create(sb: SupabaseClient, tenantId: string, form: ResourceUnavailabilityFormData): Promise<ResourceUnavailability> {
    const data = await query(
      sb.from('resource_unavailability')
        .insert({
          tenant_id: tenantId,
          resource_id: form.resourceId,
          date_from: form.dateFrom,
          date_to: form.dateTo,
          reason: form.reason,
          notes: form.notes ?? null,
        })
        .select('*')
        .single(),
    )

    return mapResourceUnavailability(data as unknown as ResourceUnavailabilityRow)
  },

  async update(sb: SupabaseClient, id: string, patch: Partial<Omit<ResourceUnavailabilityFormData, 'resourceId'>>): Promise<ResourceUnavailability> {
    const payload: Record<string, unknown> = {}

    if (patch.dateFrom !== undefined) payload.date_from = patch.dateFrom
    if (patch.dateTo !== undefined) payload.date_to = patch.dateTo
    if (patch.reason !== undefined) payload.reason = patch.reason
    if (patch.notes !== undefined) payload.notes = patch.notes

    const data = await query(
      sb.from('resource_unavailability')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single(),
    )

    return mapResourceUnavailability(data as unknown as ResourceUnavailabilityRow)
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('resource_unavailability').delete().eq('id', id))
  },
}
