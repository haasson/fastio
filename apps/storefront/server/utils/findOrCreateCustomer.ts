import type { SupabaseClient } from '@supabase/supabase-js'
import { createError } from 'h3'
import { reportError } from '@fastio/shared/observability'

/**
 * Профиль гостя для upsert: tenant + telegram_id — natural key, остальные
 * поля опциональны. Если поле `undefined` — оно не участвует ни в insert,
 * ни в update; `null` валидно как «явно нет значения» при insert.
 *
 * Особое поведение: если у уже существующего customer'а `phone` пустой
 * (null), а в seed.phone передали значение — фон обновим телефон. Это
 * нужно для widget-полл-флоу, где номер приходит позже (Telegram запрашивает
 * permission отдельно). На остальные поля backfill не делаем — чтобы юзер,
 * сменивший имя/аватар в TG, не перетирал ручные правки в кабинете.
 */
export type CustomerSeed = {
  tenantId: string
  telegramId: string
  name?: string | null
  phone?: string | null
  photoUrl?: string | null
}

/**
 * Гарантирует существование customer-строки в (tenant_id, telegram_id) и
 * возвращает её id. Безопасно от concurrent-инсертов: при `23505` повторно
 * читает строку, которую только что создал параллельный запрос.
 *
 * Дедуплицирует логику между `/api/auth/telegram/login.post.ts` (классическая
 * Login Widget) и `/api/auth/telegram/poll.get.ts` (deep-link bot flow).
 */
export async function findOrCreateCustomer(
  supabase: SupabaseClient,
  seed: CustomerSeed,
): Promise<string> {
  const existing = await lookupCustomer(supabase, seed.tenantId, seed.telegramId)
  if (existing) {
    // Backfill phone only — см. doc-комментарий к CustomerSeed.
    if (seed.phone && !existing.phone) {
      const { error: updateError } = await supabase
        .from('customers')
        .update({ phone: seed.phone })
        .eq('id', existing.id)
      // Не падаем — phone-backfill не критичен, в худшем случае апдейтнётся
      // на следующем запросе, либо юзер заполнит вручную. Но в Sentry хотим
      // знать чтобы поймать долгоиграющие проблемы (RLS, констрейнты).
      if (updateError) reportError(updateError)
    }
    return existing.id
  }

  const insertRow: Record<string, unknown> = {
    tenant_id: seed.tenantId,
    telegram_id: seed.telegramId,
  }
  if (seed.name !== undefined) insertRow.name = seed.name
  if (seed.phone !== undefined) insertRow.phone = seed.phone
  if (seed.photoUrl !== undefined) insertRow.avatar_url = seed.photoUrl

  const { data: created, error } = await supabase
    .from('customers')
    .insert(insertRow)
    .select('id')
    .single()

  if (created) return created.id as string

  // Concurrent insert won the race — re-read the row our peer just created.
  if (error?.code === '23505') {
    const concurrent = await lookupCustomer(supabase, seed.tenantId, seed.telegramId)
    if (concurrent) return concurrent.id
  }

  reportError(error ?? new Error('customer insert returned no row'))
  throw createError({ statusCode: 500, message: 'Ошибка создания профиля' })
}

type ExistingCustomer = { id: string; phone: string | null }

async function lookupCustomer(
  supabase: SupabaseClient,
  tenantId: string,
  telegramId: string,
): Promise<ExistingCustomer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, phone')
    .eq('tenant_id', tenantId)
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (error) {
    reportError(error)
    throw createError({ statusCode: 500, message: 'Ошибка базы данных' })
  }
  if (!data) return null
  return {
    id: data.id as string,
    phone: (data.phone as string | null) ?? null,
  }
}
