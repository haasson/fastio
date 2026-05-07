import type { SupabaseClient } from '@supabase/supabase-js'
import type { TableCallType, TableCall } from '@fastio/shared'
import { query } from '~/utils/query'
import type { TableCallTypeRow, TableCallRow } from '../db-types'

const mapCallType = (raw: Record<string, unknown>): TableCallType => {
  const row = raw as TableCallTypeRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }
}

const mapCall = (raw: Record<string, unknown>): TableCall => {
  const row = raw as TableCallRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    tableId: row.table_id,
    callTypeId: row.call_type_id,
    callTypeName: row.call_type_name,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }
}

export const tableCallTypesApi = {
  async list(sb: SupabaseClient, tenantId: string): Promise<TableCallType[]> {
    const data = await query(
      sb.from('table_call_types').select('*').eq('tenant_id', tenantId).order('sort_order'),
    )

    return (data ?? []).map(mapCallType)
  },

  async add(sb: SupabaseClient, tenantId: string, name: string): Promise<TableCallType | null> {
    const result = await query(
      sb.from('table_call_types').insert({ tenant_id: tenantId, name }).select().single(),
    )

    return result ? mapCallType(result) : null
  },

  async remove(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('table_call_types').delete().eq('id', id))
  },
}

export const tableCallsApi = {
  async listActive(sb: SupabaseClient, tenantId: string): Promise<TableCall[]> {
    const data = await query(
      sb.from('table_calls').select('*').eq('tenant_id', tenantId).is('resolved_at', null).order('created_at'),
    )

    return (data ?? []).map(mapCall)
  },

  async resolve(sb: SupabaseClient, id: string): Promise<void> {
    await query(sb.from('table_calls').update({ resolved_at: new Date().toISOString() }).eq('id', id))
  },

  async create(
    sb: SupabaseClient,
    tenantId: string,
    tableId: string,
    callTypeId: string | null,
    callTypeName: string,
  ): Promise<TableCall | null> {
    const result = await query(
      sb.from('table_calls').insert({
        tenant_id: tenantId,
        table_id: tableId,
        call_type_id: callTypeId,
        call_type_name: callTypeName,
      }).select().single(),
    )

    return result ? mapCall(result) : null
  },
}
