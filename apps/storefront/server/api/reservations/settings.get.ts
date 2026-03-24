import { getServerSupabase } from '../../utils/supabase'
import type { ReservationSettings } from '@fastio/shared'

export default defineEventHandler(async (event): Promise<ReservationSettings | null> => {
  const tenantId = event.context.tenantId as string | undefined

  if (!tenantId) throw createError({ statusCode: 404 })

  const supabase = getServerSupabase()

  const { data } = await supabase
    .from('reservation_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data) return null

  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    enabled: data.enabled as boolean,
    slotStep: data.slot_step as number,
    closeBufferMinutes: (data.close_buffer_minutes as number) ?? 60,
    maxAdvanceDays: data.max_advance_days as number,
    minGuests: data.min_guests as number,
    maxGuests: data.max_guests as number,
    autoConfirm: data.auto_confirm as boolean,
  }
})
