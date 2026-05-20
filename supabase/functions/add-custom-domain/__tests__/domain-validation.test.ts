import { assertEquals, assert } from '@std/assert'
import { DOMAIN_REGEX, normalizeDomain } from '../domain-validation.ts'

// PREPROD-207: убедиться что DOMAIN_REGEX не подвержен ReDoS.
// Регекс использует bounded quantifiers ({0,61}, {1,253}) + detached lookahead —
// catastrophic backtracking невозможен теоретически. Тест зафиксирует регрессии
// если кто-то заменит на жадные unbounded quantifiers.

const MAX_REGEX_TIME_MS = 100

function measureRegex(input: string): number {
  const start = performance.now()
  DOMAIN_REGEX.test(input)
  return performance.now() - start
}

Deno.test('DOMAIN_REGEX: валидный домен — быстрый match', () => {
  assert(DOMAIN_REGEX.test('example.com'))
  assert(DOMAIN_REGEX.test('sub.example.com'))
  assert(DOMAIN_REGEX.test('xn--p1ai.xn--p1ai')) // .рф в punycode
  assert(DOMAIN_REGEX.test('a.bc'))
})

Deno.test('DOMAIN_REGEX: невалидные домены — fast reject', () => {
  assertEquals(DOMAIN_REGEX.test(''), false)
  assertEquals(DOMAIN_REGEX.test('no-dot'), false)
  assertEquals(DOMAIN_REGEX.test('-leading-hyphen.com'), false)
  assertEquals(DOMAIN_REGEX.test('trailing-hyphen-.com'), false)
  assertEquals(DOMAIN_REGEX.test('UPPERCASE.com'), false)
  assertEquals(DOMAIN_REGEX.test('label-' + 'a'.repeat(62) + '.com'), false) // >63 в label
})

Deno.test('DOMAIN_REGEX: 100K чёрная-точка input < 100ms', () => {
  // Классический ReDoS payload — много точек подряд, имитация nested alternation.
  const input = '.'.repeat(100_000)
  const time = measureRegex(input)
  console.log(`  100K dots: ${time.toFixed(2)}ms`)
  assert(time < MAX_REGEX_TIME_MS, `Expected < ${MAX_REGEX_TIME_MS}ms, got ${time}ms`)
})

Deno.test('DOMAIN_REGEX: 100K дефисов в одном label < 100ms', () => {
  // Bounded quantifier {0,61} должен зарезать backtracking даже на огромном input.
  const input = 'a' + '-'.repeat(100_000) + '.com'
  const time = measureRegex(input)
  console.log(`  100K hyphens: ${time.toFixed(2)}ms`)
  assert(time < MAX_REGEX_TIME_MS, `Expected < ${MAX_REGEX_TIME_MS}ms, got ${time}ms`)
})

Deno.test('DOMAIN_REGEX: 100K alternation pattern < 100ms', () => {
  // Атака на потенциально nested groups: много label'ов разной длины.
  const input = Array.from({ length: 10_000 }, () => 'aa').join('.') + '.com'
  const time = measureRegex(input)
  console.log(`  10K labels: ${time.toFixed(2)}ms`)
  assert(time < MAX_REGEX_TIME_MS, `Expected < ${MAX_REGEX_TIME_MS}ms, got ${time}ms`)
})

Deno.test('DOMAIN_REGEX: 100K mix [a-z0-9-] payload < 100ms', () => {
  // Симулирует «легально выглядящий» domain что прошёл бы char-class, но не
  // matches из-за общей длины (>253). Lookahead должен срубить за один проход.
  const input = 'a-9'.repeat(40_000) + '.com'
  const time = measureRegex(input)
  console.log(`  120K mixed: ${time.toFixed(2)}ms`)
  assert(time < MAX_REGEX_TIME_MS, `Expected < ${MAX_REGEX_TIME_MS}ms, got ${time}ms`)
})

Deno.test('normalizeDomain: extreme input — fast reject', () => {
  const start = performance.now()
  const result = normalizeDomain('a'.repeat(100_000) + '.com')
  const time = performance.now() - start
  console.log(`  normalizeDomain 100K: ${time.toFixed(2)}ms`)
  assertEquals(result.ok, false)
  assert(time < MAX_REGEX_TIME_MS, `Expected < ${MAX_REGEX_TIME_MS}ms, got ${time}ms`)
})

Deno.test('normalizeDomain: legitimate inputs', () => {
  assertEquals(normalizeDomain('example.com'), { ok: true, domain: 'example.com' })
  assertEquals(normalizeDomain('  EXAMPLE.com  '), { ok: true, domain: 'example.com' })
  assertEquals(normalizeDomain('https://example.com/path?q=1'), { ok: true, domain: 'example.com' })
  assertEquals(normalizeDomain('www.example.com').ok, false) // www не разрешён
  assertEquals(normalizeDomain('localhost').ok, false)
  assertEquals(normalizeDomain('127.0.0.1').ok, false)
  assertEquals(normalizeDomain('').ok, false)
  assertEquals(normalizeDomain(undefined).ok, false)
  assertEquals(normalizeDomain(42 as unknown).ok, false)
})
