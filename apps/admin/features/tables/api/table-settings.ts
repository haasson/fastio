import type { SupabaseClient } from '@supabase/supabase-js'
import type { TableSettings, TableSettingsFormData } from '@fastio/shared'
import { mapTableSettings } from '@fastio/shared'
import type { TableSettingsRow } from '~/shared/data/db-types'
import { query } from '~/shared/utils/query'

export const tableSettingsApi = {
  async get(sb: SupabaseClient, tenantId: string): Promise<TableSettings | null> {
    const { data, error } = await sb
      .from('table_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) throw new Error(error.message)

    return data ? mapTableSettings(data as unknown as TableSettingsRow) : null
  },

  async upsert(sb: SupabaseClient, tenantId: string, form: TableSettingsFormData): Promise<TableSettings> {
    const payload: Record<string, unknown> = { tenant_id: tenantId }

    if (form.callButtonLabel !== undefined) payload.call_button_label = form.callButtonLabel
    if (form.callButtonIcon !== undefined) payload.call_button_icon = form.callButtonIcon
    if (form.callCooldownSeconds !== undefined) payload.call_cooldown_seconds = form.callCooldownSeconds
    if (form.callEscalationMinutes !== undefined) payload.call_escalation_minutes = form.callEscalationMinutes
    if (form.canvasTileSize !== undefined) payload.canvas_tile_size = form.canvasTileSize
    if (form.showDishCategory !== undefined) payload.show_dish_category = form.showDishCategory
    if (form.listPreviewRows !== undefined) payload.list_preview_rows = form.listPreviewRows

    const result = await query(
      sb.from('table_settings')
        .upsert(payload, { onConflict: 'tenant_id' })
        .select('*')
        .single(),
    )

    return mapTableSettings(result as unknown as TableSettingsRow)
  },
}
