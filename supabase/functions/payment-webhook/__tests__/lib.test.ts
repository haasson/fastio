import { assertEquals } from 'jsr:@std/assert@1'
import { verifyYookassaHmac } from '../lib.ts'

// Тестовый секрет (32 байта — рекомендуется для HMAC-SHA256).
// Не настоящий, не использовать нигде в проде.
const SECRET = 'test-secret-32-chars-1234567890ab'

async function computeHmacHex(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.test('verifyYookassaHmac: valid signature with v1= prefix passes', async () => {
  const body = '{"event":"payment.succeeded","object":{"id":"abc"}}'
  const hex = await computeHmacHex(body, SECRET)
  const result = await verifyYookassaHmac(body, `v1=${hex}`, SECRET)
  assertEquals(result.ok, true)
})

Deno.test('verifyYookassaHmac: valid signature without v1= prefix also passes', async () => {
  const body = '{"event":"payment.succeeded"}'
  const hex = await computeHmacHex(body, SECRET)
  const result = await verifyYookassaHmac(body, hex, SECRET)
  assertEquals(result.ok, true)
})

Deno.test('verifyYookassaHmac: non-hex characters → invalid_format', async () => {
  const result = await verifyYookassaHmac('body', 'v1=xyz123', SECRET)
  assertEquals(result, { ok: false, reason: 'invalid_format' })
})

Deno.test('verifyYookassaHmac: odd-length hex → invalid_format', async () => {
  // 63 символа вместо 64 (SHA-256 = 64 hex)
  const result = await verifyYookassaHmac('body', 'v1=abc', SECRET)
  assertEquals(result, { ok: false, reason: 'invalid_format' })
})

Deno.test('verifyYookassaHmac: empty signature → invalid_format', async () => {
  const result = await verifyYookassaHmac('body', '', SECRET)
  assertEquals(result, { ok: false, reason: 'invalid_format' })
})

Deno.test('verifyYookassaHmac: only v1= prefix → invalid_format', async () => {
  const result = await verifyYookassaHmac('body', 'v1=', SECRET)
  assertEquals(result, { ok: false, reason: 'invalid_format' })
})

Deno.test('verifyYookassaHmac: tampered body → invalid_signature', async () => {
  const body = '{"event":"payment.succeeded","object":{"id":"abc"}}'
  const hex = await computeHmacHex(body, SECRET)
  const result = await verifyYookassaHmac(
    '{"event":"payment.succeeded","object":{"id":"TAMPERED"}}',
    `v1=${hex}`,
    SECRET,
  )
  assertEquals(result, { ok: false, reason: 'invalid_signature' })
})

Deno.test('verifyYookassaHmac: wrong secret → invalid_signature', async () => {
  const body = '{"event":"payment.succeeded"}'
  const hex = await computeHmacHex(body, SECRET)
  const result = await verifyYookassaHmac(body, `v1=${hex}`, 'wrong-secret-key')
  assertEquals(result, { ok: false, reason: 'invalid_signature' })
})

Deno.test('verifyYookassaHmac: signature for empty body verifies correctly', async () => {
  const hex = await computeHmacHex('', SECRET)
  const result = await verifyYookassaHmac('', `v1=${hex}`, SECRET)
  assertEquals(result.ok, true)
})

Deno.test('verifyYookassaHmac: uppercase hex accepted', async () => {
  const body = '{"event":"payment.succeeded"}'
  const hex = (await computeHmacHex(body, SECRET)).toUpperCase()
  const result = await verifyYookassaHmac(body, `v1=${hex}`, SECRET)
  assertEquals(result.ok, true)
})
