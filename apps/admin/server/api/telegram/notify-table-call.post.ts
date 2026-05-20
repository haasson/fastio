import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { reportError } from '@fastio/shared/observability'
import { getServerSupabase } from '../../utils/supabase'
import { requireInternalSecret } from '../../utils/auth'
import { broadcastToTenantTelegram } from '../../utils/telegramBroadcast'

// PREPROD-019: Telegram-уведомление о вызове официанта с QR-меню.
// Триггер из миграции 299 шлёт сюда сразу после INSERT в table_calls.
// Без этого менеджер не узнает о вызове, пока не откроет /tables/calls.

export default defineEventHandler(async (event) => {
  requireInternalSecret(event)

  const { tableCallId, tenantId } = await readBody(event)

  if (!tableCallId || !tenantId) return { ok: true }

  const config = useRuntimeConfig()
  const token = config.telegramTenantBotToken

  if (!token) return { ok: true }

  const supabase = getServerSupabase()

  const { data: call, error: callErr } = await supabase
    .from('table_calls')
    .select(`
      id, call_type_name,
      tables ( name )
    `)
    .eq('id', tableCallId)
    .eq('tenant_id', tenantId)
    .single()

  if (callErr) reportError(callErr, { ctx: 'notify-table-call.load', tableCallId, tenantId })

  if (!call) return { ok: true }

  const tableName = (call.tables as { name?: string } | null)?.name ?? '—'
  const callType = call.call_type_name?.trim() || 'Вызов официанта'

  const text = [
    '🛎 <b>Вызов официанта</b>',
    '',
    `🪑 Стол: <b>${escapeHtml(tableName)}</b>`,
    `📋 ${escapeHtml(callType)}`,
  ].join('\n')

  await broadcastToTenantTelegram(supabase, token, tenantId, () => ({
    text,
    parse_mode: 'HTML',
  }), 'telegram notify-table-call')

  return { ok: true }
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
