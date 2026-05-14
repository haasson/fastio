// SSRF-защита и helper'ы для proxy-image — вынесены сюда чтобы их можно было
// покрыть unit-тестами без Deno.serve. isPrivateIPv4 / isPrivateIPv6 /
// readBodyWithLimit — pure (тестируются без сети). resolvesToPublicIp дёргает
// Deno.resolveDns; в тестах сетевые ветки требуют --allow-net, но input-чек
// для raw-IP литералов проходит до резолва и тоже тестируется без сети.

// SSRF: фильтруем результат DNS-резолва, а не сам hostname (DNS rebinding обходит host-check).
// Между нашим resolveDns и fetch'ом Deno делает свой резолв — это TOCTOU race, но без low-level
// контроля над сокетом в Deno edge runtime закрыть его нельзя; принят как known risk.
export function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true
  const [a, b] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // link-local + cloud metadata (AWS/GCP/Azure)
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && (b === 0 || b === 168)) return true
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast + reserved
  return false
}

export function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (lower === '::1' || lower === '::') return true
  if (lower.startsWith('fe80:') || lower.startsWith('fec0:')) return true // link-local + deprecated site-local
  if (/^f[cd]/.test(lower)) return true // unique-local (fc00::/7)
  if (lower.startsWith('ff')) return true // multicast
  if (lower.startsWith('64:ff9b:')) return true // NAT64
  if (lower.startsWith('100::')) return true // discard prefix
  if (lower.startsWith('2001:db8:')) return true // documentation
  if (lower.startsWith('2001:0:') || lower.startsWith('2001::')) return true // Teredo
  if (lower.startsWith('2002:')) return true // 6to4 (deprecated)
  const mapped = lower.match(/^::ffff:([\d.]+)$/)
  if (mapped) return isPrivateIPv4(mapped[1])
  return false
}

export async function resolvesToPublicIp(hostname: string): Promise<boolean> {
  // IPv4 в decimal/hex/octal формах (2130706433, 0x7f000001) сюда не попадают —
  // их Deno.resolveDns ниже отвергнет как невалидный hostname → fail-closed.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return !isPrivateIPv4(hostname)
  if (hostname.includes(':')) return !isPrivateIPv6(hostname)

  try {
    const [a, aaaa] = await Promise.all([
      Deno.resolveDns(hostname, 'A').catch(() => [] as string[]),
      Deno.resolveDns(hostname, 'AAAA').catch(() => [] as string[]),
    ])
    if (a.length === 0 && aaaa.length === 0) return false
    if (a.some((ip) => isPrivateIPv4(ip))) return false
    if (aaaa.some((ip) => isPrivateIPv6(ip))) return false
    return true
  } catch {
    return false // fail closed
  }
}

// Стрим-based чтение body с early-abort при превышении лимита — не выделяем 10MB+ если ответ большой.
export async function readBodyWithLimit(response: Response, limit: number): Promise<Uint8Array | null> {
  const reader = response.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let received = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (!value) continue
      received += value.byteLength
      if (received > limit) {
        await reader.cancel()
        return null // превышен лимит
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const merged = new Uint8Array(received)
  let offset = 0
  for (const c of chunks) { merged.set(c, offset); offset += c.byteLength }
  return merged
}
