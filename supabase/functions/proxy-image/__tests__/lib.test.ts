import { assertEquals } from 'jsr:@std/assert@1'
import {
  isPrivateIPv4,
  isPrivateIPv6,
  readBodyWithLimit,
  resolvesToPublicIp,
} from '../lib.ts'

// ─── isPrivateIPv4 ──────────────────────────────────────────────────────────

Deno.test('isPrivateIPv4: 0.0.0.0 (wildcard) → true', () => {
  assertEquals(isPrivateIPv4('0.0.0.0'), true)
})

Deno.test('isPrivateIPv4: 10.x (private RFC1918) → true', () => {
  assertEquals(isPrivateIPv4('10.0.0.1'), true)
  assertEquals(isPrivateIPv4('10.255.255.255'), true)
})

Deno.test('isPrivateIPv4: 127.x (loopback) → true', () => {
  assertEquals(isPrivateIPv4('127.0.0.1'), true)
  assertEquals(isPrivateIPv4('127.255.0.1'), true)
})

Deno.test('isPrivateIPv4: 169.254.x (link-local + cloud metadata) → true', () => {
  // AWS/GCP/Azure metadata endpoint — критично для SSRF
  assertEquals(isPrivateIPv4('169.254.169.254'), true)
  assertEquals(isPrivateIPv4('169.254.0.1'), true)
})

Deno.test('isPrivateIPv4: 169.x where !254 → false', () => {
  assertEquals(isPrivateIPv4('169.1.0.1'), false)
})

Deno.test('isPrivateIPv4: 172.16-31.x (private RFC1918) → true', () => {
  assertEquals(isPrivateIPv4('172.16.0.1'), true)
  assertEquals(isPrivateIPv4('172.31.255.255'), true)
})

Deno.test('isPrivateIPv4: 172.15 / 172.32 (out of private range) → false', () => {
  assertEquals(isPrivateIPv4('172.15.0.1'), false)
  assertEquals(isPrivateIPv4('172.32.0.1'), false)
})

Deno.test('isPrivateIPv4: 192.168.x (home network) → true', () => {
  assertEquals(isPrivateIPv4('192.168.1.1'), true)
})

Deno.test('isPrivateIPv4: 192.0.x (reserved) → true', () => {
  assertEquals(isPrivateIPv4('192.0.2.1'), true)
})

Deno.test('isPrivateIPv4: 198.18-19 (benchmarking) → true', () => {
  assertEquals(isPrivateIPv4('198.18.0.1'), true)
  assertEquals(isPrivateIPv4('198.19.255.255'), true)
})

Deno.test('isPrivateIPv4: 100.64-127.x (CGNAT) → true', () => {
  assertEquals(isPrivateIPv4('100.64.0.1'), true)
  assertEquals(isPrivateIPv4('100.127.255.255'), true)
})

Deno.test('isPrivateIPv4: 100.63 / 100.128 (outside CGNAT) → false', () => {
  assertEquals(isPrivateIPv4('100.63.0.1'), false)
  assertEquals(isPrivateIPv4('100.128.0.1'), false)
})

Deno.test('isPrivateIPv4: 224+ (multicast + reserved) → true', () => {
  assertEquals(isPrivateIPv4('224.0.0.1'), true)
  assertEquals(isPrivateIPv4('255.255.255.255'), true)
})

Deno.test('isPrivateIPv4: public IPs (Google/Cloudflare DNS) → false', () => {
  assertEquals(isPrivateIPv4('8.8.8.8'), false)
  assertEquals(isPrivateIPv4('1.1.1.1'), false)
  assertEquals(isPrivateIPv4('208.67.222.222'), false)
})

Deno.test('isPrivateIPv4: invalid format → true (fail-closed)', () => {
  // Невалидный hostname как IPv4 — лучше считать private, чтобы не пропустить SSRF
  assertEquals(isPrivateIPv4('not-an-ip'), true)
  assertEquals(isPrivateIPv4('1.2.3'), true)
  assertEquals(isPrivateIPv4('1.2.3.256'), true)
  assertEquals(isPrivateIPv4('-1.0.0.0'), true)
  assertEquals(isPrivateIPv4(''), true)
})

// ─── isPrivateIPv6 ──────────────────────────────────────────────────────────

Deno.test('isPrivateIPv6: ::1 (loopback) → true', () => {
  assertEquals(isPrivateIPv6('::1'), true)
})

Deno.test('isPrivateIPv6: :: (unspecified) → true', () => {
  assertEquals(isPrivateIPv6('::'), true)
})

Deno.test('isPrivateIPv6: bracketed [::1] (URL-style) → true', () => {
  assertEquals(isPrivateIPv6('[::1]'), true)
})

Deno.test('isPrivateIPv6: fe80: (link-local) → true', () => {
  assertEquals(isPrivateIPv6('fe80::1'), true)
  assertEquals(isPrivateIPv6('FE80::abcd'), true) // case-insensitive
})

Deno.test('isPrivateIPv6: fec0: (deprecated site-local) → true', () => {
  assertEquals(isPrivateIPv6('fec0::1'), true)
})

Deno.test('isPrivateIPv6: fc00:: / fd00:: (unique-local) → true', () => {
  assertEquals(isPrivateIPv6('fc00::1'), true)
  assertEquals(isPrivateIPv6('fd00::1'), true)
})

Deno.test('isPrivateIPv6: ff:: (multicast) → true', () => {
  assertEquals(isPrivateIPv6('ff02::1'), true)
})

Deno.test('isPrivateIPv6: 64:ff9b:: (NAT64) → true', () => {
  assertEquals(isPrivateIPv6('64:ff9b::1'), true)
})

Deno.test('isPrivateIPv6: 100:: (discard prefix) → true', () => {
  assertEquals(isPrivateIPv6('100::1'), true)
})

Deno.test('isPrivateIPv6: 2001:db8:: (documentation) → true', () => {
  assertEquals(isPrivateIPv6('2001:db8::1'), true)
})

Deno.test('isPrivateIPv6: 2001:: (Teredo) → true', () => {
  assertEquals(isPrivateIPv6('2001::1'), true)
  assertEquals(isPrivateIPv6('2001:0:abcd::'), true)
})

Deno.test('isPrivateIPv6: 2002:: (deprecated 6to4) → true', () => {
  assertEquals(isPrivateIPv6('2002::1'), true)
})

Deno.test('isPrivateIPv6: IPv4-mapped ::ffff:127.0.0.1 (loopback via IPv4) → true', () => {
  assertEquals(isPrivateIPv6('::ffff:127.0.0.1'), true)
  assertEquals(isPrivateIPv6('::ffff:10.0.0.1'), true)
  assertEquals(isPrivateIPv6('::ffff:169.254.169.254'), true)
})

Deno.test('isPrivateIPv6: IPv4-mapped public ::ffff:8.8.8.8 → false', () => {
  assertEquals(isPrivateIPv6('::ffff:8.8.8.8'), false)
})

Deno.test('isPrivateIPv6: public IPv6 (Google DNS) → false', () => {
  assertEquals(isPrivateIPv6('2001:4860:4860::8888'), false)
})

// ─── readBodyWithLimit ──────────────────────────────────────────────────────

function makeResponse(body: Uint8Array | null): Response {
  if (body === null) return new Response(null)
  return new Response(body)
}

Deno.test('readBodyWithLimit: empty body → empty Uint8Array', async () => {
  const res = makeResponse(new Uint8Array(0))
  const result = await readBodyWithLimit(res, 1024)
  assertEquals(result?.byteLength, 0)
})

Deno.test('readBodyWithLimit: body within limit → returns body', async () => {
  const data = new Uint8Array([1, 2, 3, 4, 5])
  const res = makeResponse(data)
  const result = await readBodyWithLimit(res, 1024)
  assertEquals(result, data)
})

Deno.test('readBodyWithLimit: body exactly at limit → returns body', async () => {
  const data = new Uint8Array(100).fill(0x42)
  const res = makeResponse(data)
  const result = await readBodyWithLimit(res, 100)
  assertEquals(result?.byteLength, 100)
})

Deno.test('readBodyWithLimit: body over limit → null (early abort)', async () => {
  const data = new Uint8Array(200).fill(0x42)
  const res = makeResponse(data)
  const result = await readBodyWithLimit(res, 100)
  assertEquals(result, null)
})

Deno.test('readBodyWithLimit: no body reader (null body) → null', async () => {
  const res = new Response(null)
  const result = await readBodyWithLimit(res, 1024)
  assertEquals(result, null)
})

// ─── resolvesToPublicIp (raw-IP ветки, без сети) ────────────────────────────
// Для hostname-веток нужен Deno.resolveDns + --allow-net; здесь покрываем
// только raw-IP литералы, которые отрабатываются до DNS-резолва.

Deno.test('resolvesToPublicIp: IPv4 literal 169.254.169.254 (cloud metadata) → false', async () => {
  assertEquals(await resolvesToPublicIp('169.254.169.254'), false)
})

Deno.test('resolvesToPublicIp: IPv4 literal 127.0.0.1 (loopback) → false', async () => {
  assertEquals(await resolvesToPublicIp('127.0.0.1'), false)
})

Deno.test('resolvesToPublicIp: IPv4 literal 10.0.0.1 (private) → false', async () => {
  assertEquals(await resolvesToPublicIp('10.0.0.1'), false)
})

Deno.test('resolvesToPublicIp: IPv4 literal 8.8.8.8 (public) → true', async () => {
  assertEquals(await resolvesToPublicIp('8.8.8.8'), true)
})

Deno.test('resolvesToPublicIp: IPv6 literal ::1 (loopback) → false', async () => {
  assertEquals(await resolvesToPublicIp('::1'), false)
})

Deno.test('resolvesToPublicIp: IPv6 literal fc00::1 (unique-local) → false', async () => {
  assertEquals(await resolvesToPublicIp('fc00::1'), false)
})

Deno.test('resolvesToPublicIp: IPv6 literal 2001:4860:4860::8888 (public) → true', async () => {
  assertEquals(await resolvesToPublicIp('2001:4860:4860::8888'), true)
})

Deno.test('resolvesToPublicIp: IPv4 в decimal-форме (DNS-rebinding обход) → fail-closed', async () => {
  // 2130706433 = 127.0.0.1 в decimal. Не матчит ^\d{1,3}(\.\d{1,3}){3}$,
  // улетает в Deno.resolveDns → невалидный hostname → false (fail-closed).
  // Это не сетевой тест: resolveDns синхронно отвергнет такой формат.
  assertEquals(await resolvesToPublicIp('2130706433'), false)
})
