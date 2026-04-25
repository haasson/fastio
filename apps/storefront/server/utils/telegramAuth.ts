import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto'

// Telegram recommends rejecting auth payloads older than ~5 minutes to limit replay window.
export const AUTH_DATA_MAX_AGE_SEC = 300

export const TG_SESSION_TOKEN_PREFIX = 'tgs_'
export const TG_SESSION_COOKIE_NAME = 'tg_session'

export type TelegramAuthPayload = {
  id?: unknown
  first_name?: unknown
  last_name?: unknown
  username?: unknown
  photo_url?: unknown
  auth_date?: unknown
  hash?: unknown
}

export type TelegramAuthVerification =
  | { ok: true; telegramId: string; firstName: string | null; lastName: string | null; username: string | null; photoUrl: string | null }
  | { ok: false; reason: 'missing' | 'expired' | 'bad_signature' }

/**
 * Verifies the HMAC signature of a Telegram Login Widget payload per
 * https://core.telegram.org/widgets/login#checking-authorization.
 *
 * `now` is injectable so tests can pin time without mocking Date.
 */
export function verifyTelegramAuth(
  payload: TelegramAuthPayload,
  botToken: string,
  now: number = Math.floor(Date.now() / 1000),
): TelegramAuthVerification {
  const { id, first_name, last_name, username, photo_url, auth_date, hash } = payload

  if (!id || !auth_date || !hash) return { ok: false, reason: 'missing' }

  const authDateNum = parseInt(String(auth_date), 10)
  if (!Number.isFinite(authDateNum) || now - authDateNum > AUTH_DATA_MAX_AGE_SEC) {
    return { ok: false, reason: 'expired' }
  }

  const fields: Record<string, string> = { id: String(id), auth_date: String(auth_date) }
  if (first_name) fields.first_name = String(first_name)
  if (last_name) fields.last_name = String(last_name)
  if (username) fields.username = String(username)
  if (photo_url) fields.photo_url = String(photo_url)

  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')

  const secretKey = createHash('sha256').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (!hashesEqual(expectedHash, String(hash))) return { ok: false, reason: 'bad_signature' }

  return {
    ok: true,
    telegramId: String(id),
    firstName: first_name ? String(first_name) : null,
    lastName: last_name ? String(last_name) : null,
    username: username ? String(username) : null,
    photoUrl: photo_url ? String(photo_url) : null,
  }
}

// Constant-time hex string comparison; throws on length mismatch (cheap to handle separately).
function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/** Issues a fresh session token. Caller stores SHA-256 hash; raw value goes only to the cookie. */
export function issueSessionToken(): { token: string; hash: string } {
  const token = TG_SESSION_TOKEN_PREFIX + randomUUID().replace(/-/g, '')
  return { token, hash: hashSessionToken(token) }
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
