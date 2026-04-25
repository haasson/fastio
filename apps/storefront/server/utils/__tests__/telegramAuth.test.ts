import { describe, it, expect } from 'vitest'
import { createHash, createHmac } from 'node:crypto'
import {
  verifyTelegramAuth,
  AUTH_DATA_MAX_AGE_SEC,
  hashSessionToken,
  issueSessionToken,
  TG_SESSION_TOKEN_PREFIX,
} from '../telegramAuth'

const BOT_TOKEN = 'test-bot-token:abc123'

function sign(fields: Record<string, string>) {
  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
  const secretKey = createHash('sha256').update(BOT_TOKEN).digest()
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex')
}

function makeValidPayload(overrides: Record<string, string> = {}) {
  const authDate = String(Math.floor(Date.now() / 1000))
  const base = {
    id: '123456789',
    first_name: 'Иван',
    last_name: 'Петров',
    username: 'ivan',
    photo_url: 'https://t.me/i/userpic/123.jpg',
    auth_date: authDate,
    ...overrides,
  }
  const hash = sign(base)
  return { ...base, hash }
}

describe('verifyTelegramAuth', () => {
  it('accepts a correctly signed fresh payload', () => {
    const result = verifyTelegramAuth(makeValidPayload(), BOT_TOKEN)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.telegramId).toBe('123456789')
      expect(result.firstName).toBe('Иван')
      expect(result.username).toBe('ivan')
    }
  })

  it('rejects payload with missing required fields', () => {
    const result = verifyTelegramAuth({ id: '123' }, BOT_TOKEN)
    expect(result).toEqual({ ok: false, reason: 'missing' })
  })

  it('rejects payload older than max age', () => {
    const now = Math.floor(Date.now() / 1000)
    const stale = makeValidPayload({ auth_date: String(now - AUTH_DATA_MAX_AGE_SEC - 60) })
    const { hash: _drop, ...rest } = stale
    const fixed = { ...rest, hash: sign(rest) }
    const result = verifyTelegramAuth(fixed, BOT_TOKEN, now)
    expect(result).toEqual({ ok: false, reason: 'expired' })
  })

  it('rejects payload with tampered hash', () => {
    const payload = makeValidPayload()
    payload.hash = 'deadbeef'.repeat(8)
    const result = verifyTelegramAuth(payload, BOT_TOKEN)
    expect(result).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects payload signed with a different bot token', () => {
    const payload = makeValidPayload()
    const result = verifyTelegramAuth(payload, 'wrong-token')
    expect(result).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects payload with tampered telegram id (signature mismatch)', () => {
    const payload = makeValidPayload()
    payload.id = '987654321' // hash was computed for 123456789
    const result = verifyTelegramAuth(payload, BOT_TOKEN)
    expect(result).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects payload whose hash has unexpected length (no buffer overrun)', () => {
    const payload = makeValidPayload()
    payload.hash = 'abc' // hex of length 3 — neither valid hex nor matching length
    const result = verifyTelegramAuth(payload, BOT_TOKEN)
    expect(result).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('handles payload without optional fields', () => {
    const authDate = String(Math.floor(Date.now() / 1000))
    const base = { id: '5555', auth_date: authDate }
    const result = verifyTelegramAuth({ ...base, hash: sign(base) }, BOT_TOKEN)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.telegramId).toBe('5555')
      expect(result.firstName).toBeNull()
      expect(result.username).toBeNull()
    }
  })

  it('preserves large telegram ids as strings (no precision loss)', () => {
    const authDate = String(Math.floor(Date.now() / 1000))
    const bigId = '9007199254740993' // 2^53 + 1, unsafe as JS number
    const base = { id: bigId, auth_date: authDate }
    const result = verifyTelegramAuth({ ...base, hash: sign(base) }, BOT_TOKEN)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.telegramId).toBe(bigId)
  })
})

describe('session tokens', () => {
  it('issued tokens carry the prefix and a 32-hex random body', () => {
    const { token, hash } = issueSessionToken()
    expect(token.startsWith(TG_SESSION_TOKEN_PREFIX)).toBe(true)
    expect(token.slice(TG_SESSION_TOKEN_PREFIX.length)).toMatch(/^[0-9a-f]{32}$/)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('issueSessionToken returns a hash that matches hashSessionToken', () => {
    const { token, hash } = issueSessionToken()
    expect(hash).toBe(hashSessionToken(token))
  })

  it('two issued tokens are unique (no collisions in 1000 samples)', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 1000; i++) tokens.add(issueSessionToken().token)
    expect(tokens.size).toBe(1000)
  })
})
