import { defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { formatPhone, normalizePhone } from '@fastio/shared'
import { reportError } from '@fastio/shared/observability'
import { getServerSupabase } from '../../utils/supabase'
import { requireInternalSecret } from '../../utils/auth'
import { broadcastToTenantTelegram } from '../../utils/telegramBroadcast'

// PREPROD-019: Telegram-уведомление о новой записи / заявке на услугу.
// Триггер из миграции 299 шлёт сюда сразу после INSERT в appointment_groups
// (status ∈ {'active', 'request'}). Один endpoint, два формата по статусу.
//
// Источник вызова — асинхронный pg_net поверх AFTER INSERT триггера. К моменту
// доставки HTTP-запроса транзакция уже закоммичена, поэтому safe читать
// связанные appointments (для status='active') / requested_services (для 'request').

export default defineEventHandler(async (event) => {
  requireInternalSecret(event)

  const { appointmentGroupId, tenantId } = await readBody(event)

  if (!appointmentGroupId || !tenantId) return { ok: true }

  const config = useRuntimeConfig()
  const token = config.telegramTenantBotToken
  const adminUrl = config.adminUrl?.trim()

  if (!token) return { ok: true }

  const supabase = getServerSupabase()

  const [{ data: tenant, error: tenantErr }, { data: group, error: groupErr }] = await Promise.all([
    supabase.from('tenants').select('timezone').eq('id', tenantId).single(),
    supabase
      .from('appointment_groups')
      .select(`
        id, status,
        customer_name, customer_phone,
        notes, requested_services,
        created_at
      `)
      .eq('id', appointmentGroupId)
      .eq('tenant_id', tenantId)
      .single(),
  ])

  if (tenantErr) reportError(tenantErr, { ctx: 'notify-appointment-group.tenant', tenantId })
  if (groupErr) reportError(groupErr, { ctx: 'notify-appointment-group.group', appointmentGroupId })

  if (!group) return { ok: true }

  // Race-guard: триггер сработал на INSERT, но к моменту доставки HTTP-запроса
  // менеджер мог быстро отменить группу (status='cancelled'). Не флудим TG.
  if (group.status === 'cancelled') return { ok: true }

  // Для активных записей подтягиваем slots + resource + service_price (snapshot
  // из 217). Для заявок этого набора нет — там только requested_services.
  let slots: Array<{
    starts_at: string
    ends_at: string
    service_name: string
    service_price: number
    resource_name: string | null
  }> = []

  if (group.status === 'active') {
    const { data: appts, error: apptsErr } = await supabase
      .from('appointments')
      .select(`
        starts_at, ends_at, service_name, service_price, status,
        resources ( name )
      `)
      .eq('group_id', group.id)
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .order('starts_at', { ascending: true })

    if (apptsErr) reportError(apptsErr, { ctx: 'notify-appointment-group.appointments', appointmentGroupId })

    slots = (appts ?? []).map((a) => ({
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      service_name: a.service_name || 'Услуга',
      service_price: Number(a.service_price ?? 0),
      resource_name: (a.resources as { name?: string } | null)?.name ?? null,
    }))
  }

  const tz = tenant?.timezone

  const text = group.status === 'request'
    ? buildRequestText(group, appointmentGroupId)
    : buildActiveText(group, slots, tz)

  const phoneDigits = normalizePhone(group.customer_phone)
  const replyMarkup = adminUrl
    ? {
        inline_keyboard: [[{ text: '📞 Позвонить', url: `${adminUrl}/api/tel/${phoneDigits}` }]],
      }
    : null

  const logTag = 'telegram notify-appointment-group'

  await broadcastToTenantTelegram(supabase, token, tenantId, () => ({
    text,
    parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  }), logTag)

  return { ok: true }
})

type GroupRow = {
  id?: string
  customer_name: string
  customer_phone: string
  notes: string | null
  requested_services: unknown
}

function buildActiveText(
  group: GroupRow,
  slots: Array<{ starts_at: string; ends_at: string; service_name: string; service_price: number; resource_name: string | null }>,
  tz?: string,
): string {
  let text = '✨ <b>Новая запись</b>\n\n'

  text += `👤 ${escapeHtml(group.customer_name)}\n`
  // formatPhone может вернуть сырой инпут на невалидном номере → защищаем от HTML inject
  text += `📞 ${escapeHtml(formatPhone(group.customer_phone))}\n`

  const first = slots[0]

  if (first) {
    text += `🗓 ${formatDateTime(first.starts_at, tz)}\n`

    text += `\n📋 Услуги:\n`

    for (const s of slots) {
      const duration = minutesBetween(s.starts_at, s.ends_at)
      const time = formatTime(s.starts_at, tz)
      const parts = [
        `• ${time} — ${escapeHtml(s.service_name)} (${duration} мин)`,
      ]

      if (s.resource_name) parts.push(`мастер ${escapeHtml(s.resource_name)}`)
      text += parts.join(', ') + '\n'
    }
  }

  // total_price/total_duration_minutes были дропнуты миграцией 222 — считаем из snapshot'ов.
  const totalPrice = slots.reduce((sum, s) => sum + s.service_price, 0)

  if (totalPrice > 0) {
    text += `\n💰 Итого: ${formatRub(totalPrice)}\n`
  }

  if (group.notes) text += `\n💬 ${escapeHtml(group.notes)}\n`

  return text.trimEnd()
}

function buildRequestText(group: GroupRow, appointmentGroupId: string): string {
  let text = '📩 <b>Новая заявка</b>\n\n'

  text += `👤 ${escapeHtml(group.customer_name)}\n`
  text += `📞 ${escapeHtml(formatPhone(group.customer_phone))}\n`

  const services = parseRequestedServices(group.requested_services, appointmentGroupId)

  if (services.length) {
    text += `\n📋 Услуги:\n`
    for (const s of services) {
      text += `• ${escapeHtml(s)}\n`
    }
  }

  if (group.notes) text += `\n💬 ${escapeHtml(group.notes)}\n`

  return text.trimEnd()
}

function parseRequestedServices(raw: unknown, appointmentGroupId: string): string[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) {
    // Заявка пришла с заполненным полем, но формат сломан — это data-bug, заявляем в Sentry.
    reportError(new Error('notify-appointment-group: requested_services is not an array'), {
      ctx: 'parseRequestedServices.typeMismatch',
      appointmentGroupId,
      rawType: typeof raw,
    })

    return []
  }

  const parsed = raw
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim()
      if (entry && typeof entry === 'object' && 'service_name' in entry) {
        const name = (entry as { service_name?: unknown }).service_name

        return typeof name === 'string' ? name.trim() : null
      }

      return null
    })
    .filter((s): s is string => Boolean(s))

  // Поле было заполнено, но ничего не вытащилось → schema-drift, сигналим.
  if (raw.length > 0 && parsed.length === 0) {
    reportError(new Error('notify-appointment-group: requested_services has elements but none parseable'), {
      ctx: 'parseRequestedServices.emptyResult',
      appointmentGroupId,
      itemCount: raw.length,
    })
  }

  return parsed
}

function formatDateTime(iso: string, tz?: string): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: tz }).format(d)
  const time = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false }).format(d)

  return `${date}, ${time}`
}

function formatTime(iso: string, tz?: string): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false }).format(new Date(iso))
}

function minutesBetween(startIso: string, endIso: string): number {
  return Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000))
}

function formatRub(n: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Math.round(n))} ₽`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
