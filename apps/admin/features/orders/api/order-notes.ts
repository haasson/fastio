import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrderNote } from '@fastio/shared'
import { query } from '~/shared/utils/query'
import type { OrderNoteRow } from '~/utils/api/db-types'

export const mapOrderNote = (raw: Record<string, unknown>): OrderNote => {
  const row = raw as OrderNoteRow

  return {
    id: row.id,
    orderId: row.order_id,
    tenantId: row.tenant_id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorRole: row.author_role,
    content: row.content,
    createdAt: row.created_at,
  }
}

export const orderNotesApi = {
  async list(sb: SupabaseClient, orderId: string): Promise<OrderNote[]> {
    const data = await query(
      sb.from('order_notes').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
    )

    return (data ?? []).map(mapOrderNote)
  },

  async add(sb: SupabaseClient, params: Omit<OrderNote, 'id' | 'createdAt'>): Promise<OrderNote | null> {
    const result = await query(
      sb.from('order_notes').insert({
        order_id: params.orderId,
        tenant_id: params.tenantId,
        author_id: params.authorId,
        author_name: params.authorName,
        author_role: params.authorRole,
        content: params.content,
      }).select().single(),
    )

    return result ? mapOrderNote(result) : null
  },
}
