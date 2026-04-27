import { createError, defineEventHandler, getHeader, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getServerSupabase } from '../../utils/supabase'

const SKIP_PHONE_TEXT = 'Войти без номера'

type TgUser = { id?: number; first_name?: string; last_name?: string; username?: string }
type TgContact = { phone_number?: string; user_id?: number }
type TgMessage = { chat?: { id?: number }; from?: TgUser; text?: string; contact?: TgContact }
type TgUpdate = { message?: TgMessage }

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = config.telegramAuthBotToken

  if (!token) {
    console.warn('[tg-auth] no token, skipping')

    return { ok: true }
  }

  const webhookSecret = config.telegramWebhookSecret

  if (webhookSecret) {
    const incoming = getHeader(event, 'x-telegram-bot-api-secret-token')

    if (incoming !== webhookSecret) throw createError({ statusCode: 403 })
  }

  const body: TgUpdate = await readBody(event)
  const message = body?.message

  if (!message) {
    console.warn('[tg-auth] no message in body')

    return { ok: true }
  }

  const chatId = message.chat?.id

  if (!chatId) return { ok: true }

  const sendMessage = async (text: string, extra: Record<string, unknown> = {}) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, ...extra }),
    })
    const data = await res.json() as { ok: boolean; description?: string }

    if (!data.ok) console.error('[tg-auth] sendMessage failed:', data.description)

    return data
  }

  const supabase = getServerSupabase()
  const text: string = message.text ?? ''

  console.warn('[tg-auth] message received, text:', JSON.stringify(text), 'chatId:', chatId)

  // /start <nonce>
  const startMatch = text.match(/^\/start(?:@\S+)?\s+(\S+)/)

  if (startMatch) {
    const nonce = startMatch[1]
    const from = message.from

    console.warn('[tg-auth] /start nonce:', nonce, 'from:', from?.id)

    if (!from?.id) return { ok: true }

    const telegramId = String(from.id)
    const telegramData = {
      first_name: from.first_name ?? null,
      last_name: from.last_name ?? null,
      username: from.username ?? null,
    }

    const { data: pending, error: dbError } = await supabase
      .from('pending_telegram_auths')
      .select('nonce')
      .eq('nonce', nonce)
      .gt('expires_at', new Date().toISOString())
      .is('completed_at', null)
      .maybeSingle()

    console.warn('[tg-auth] nonce lookup:', { found: !!pending, dbError: dbError?.message })

    if (!pending) {
      await sendMessage('❌ Ссылка для входа устарела или недействительна. Попробуйте войти заново.')

      return { ok: true }
    }

    await supabase
      .from('pending_telegram_auths')
      .update({ telegram_id: telegramId, telegram_data: telegramData })
      .eq('nonce', nonce)

    await sendMessage(
      'Чтобы мы могли сохранить ваш номер телефона в профиле, нажмите кнопку ниже.\nМожно войти и без номера — он понадобится только для связи по заказу.',
      {
        reply_markup: {
          keyboard: [
            [{ text: '📱 Поделиться номером', request_contact: true }],
            [{ text: SKIP_PHONE_TEXT }],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      },
    )

    return { ok: true }
  }

  // User shared contact
  if (message.contact) {
    const phone = message.contact.phone_number?.replace(/\D/g, '') ?? null
    const telegramId = String(message.contact.user_id ?? message.from?.id ?? '')

    if (telegramId) {
      const pending = await findPendingByTelegramId(supabase, telegramId)

      if (pending) {
        await supabase
          .from('pending_telegram_auths')
          .update({ phone, completed_at: new Date().toISOString() })
          .eq('nonce', pending.nonce)
      }
    }

    await sendMessage('✅ Готово! Вернитесь на сайт — вы уже вошли в аккаунт.', {
      reply_markup: { remove_keyboard: true },
    })

    return { ok: true }
  }

  // User pressed "Войти без номера"
  if (text === SKIP_PHONE_TEXT) {
    const telegramId = String(message.from?.id ?? '')

    if (telegramId) {
      const pending = await findPendingByTelegramId(supabase, telegramId)

      if (pending) {
        await supabase
          .from('pending_telegram_auths')
          .update({ completed_at: new Date().toISOString() })
          .eq('nonce', pending.nonce)
      }
    }

    await sendMessage('✅ Готово! Вернитесь на сайт — вы уже вошли в аккаунт.', {
      reply_markup: { remove_keyboard: true },
    })

    return { ok: true }
  }

  return { ok: true }
})

async function findPendingByTelegramId(
  supabase: ReturnType<typeof getServerSupabase>,
  telegramId: string,
) {
  const { data } = await supabase
    .from('pending_telegram_auths')
    .select('nonce')
    .eq('telegram_id', telegramId)
    .is('completed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}
