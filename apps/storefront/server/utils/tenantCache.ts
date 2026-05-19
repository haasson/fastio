// PREPROD-112: in-memory tenant lookup cache + stampede protection.
//
// Стратегия freshness:
//   - Кэшируется СТАБИЛЬНАЯ часть Tenant (id, slug, theme, modules,
//     deliveryAvailable, и т.д.) на 60s. Эти поля меняются редко
//     (admin-edits конфигурации витрины).
//   - subscription.status НЕ берётся из кэша — middleware/tenant.ts
//     делает свежий SELECT subscription FROM tenants WHERE id=$1
//     по PK (быстрый, ~1ms) на каждый cache-hit. Это даёт instant
//     visibility suspended-статуса (критично для billing-флоу).
//
// Stampede protection (in-flight Map):
//   - При cache-miss N параллельных request'ов на тот же host шарят
//     один DB-lookup. Без этого получили бы N×2 SELECT'ов
//     (custom_domain + slug) при холодном старте.
//
// Trade-offs:
//   - Per-instance: при autoscaling в Coolify кэш не шарится между
//     нодами. Stable-поля реплицируются через TTL (≤60s). Volatile
//     subscription — всегда свежий по PK-запросу.
//   - Stale deliveryAvailable до 60s — приемлемо (admin сам видит
//     дашборд, юзер видит "доставка недоступна" максимум минуту).
//   - Cached tenant НЕ клонируется: middleware/handlers НЕ должны
//     мутировать event.context.tenant (subscription мерджится через
//     spread, остальные поля shared).

import type { Tenant } from '@fastio/shared'

const TTL_HIT_MS = 60_000
const TTL_MISS_MS = 10_000
// Bound на память: 10k × ~5KB на Tenant ≈ 50MB worst-case при
// атаке на random hostnames.
const MAX_ENTRIES = 10_000

type CacheEntry = { tenant: Tenant | null, expiresAt: number }

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<Tenant | null>>()
// Token идентифицирует «поколение» текущего lookup'а для каждого host'а.
// При invalidateTenantCache(host) токен удаляется → in-progress промис в
// своём finally не запишет результат в cache (см. lookupTenantByHost).
// Symbol() уникален per-call, поэтому новые lookup'ы после invalidate
// получат свежий токен.
const inflightTokens = new Map<string, symbol>()

export type TenantLookupResult =
  | { source: 'cache', tenant: Tenant | null }
  | { source: 'fresh', tenant: Tenant | null }

/**
 * Резолвит тенанта по host:
 * 1. cache-hit (positive или negative) → возвращает из кэша.
 * 2. cache-miss + есть pending lookup для этого host → ждёт его.
 * 3. cache-miss + нет pending → запускает doDbLookup, шарит промис
 *    через inflight Map, кэширует результат.
 */
export async function lookupTenantByHost(
  host: string,
  doDbLookup: () => Promise<Tenant | null>,
): Promise<TenantLookupResult> {
  const entry = cache.get(host)
  if (entry) {
    if (entry.expiresAt > Date.now()) {
      return { source: 'cache', tenant: entry.tenant }
    }
    cache.delete(host)
  }

  const existing = inflight.get(host)
  if (existing) {
    const tenant = await existing
    return { source: 'fresh', tenant }
  }

  // Identity-token на инвалидацию: если кто-то вызовет
  // invalidateTenantCache(host) пока идёт lookup, token будет удалён
  // из inflightTokens. Тогда в `then`/`finally` мы видим
  // `inflightTokens.get(host) !== myToken` и НЕ записываем результат в
  // cache — иначе восстановили бы только что инвалидированные данные.
  const myToken: symbol = Symbol()
  inflightTokens.set(host, myToken)

  const promise = (async (): Promise<Tenant | null> => {
    try {
      const tenant = await doDbLookup()
      if (inflightTokens.get(host) === myToken) {
        setCacheEntry(host, tenant)
      }
      return tenant
    } finally {
      if (inflightTokens.get(host) === myToken) {
        inflightTokens.delete(host)
        inflight.delete(host)
      }
    }
  })()
  inflight.set(host, promise)

  const tenant = await promise
  return { source: 'fresh', tenant }
}

function setCacheEntry(host: string, tenant: Tenant | null): void {
  if (cache.size >= MAX_ENTRIES && !cache.has(host)) {
    // Map iterates в insertion-order → первый ключ = oldest. Не true
    // LRU (access не обновляет позицию), но при 60s TTL «старая
    // запись» ≈ «скоро истечёт» — приемлемо.
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  // delete+set → запись попадает в конец очереди (для корректного
  // LRU-ish при eviction).
  cache.delete(host)
  cache.set(host, {
    tenant,
    expiresAt: Date.now() + (tenant ? TTL_HIT_MS : TTL_MISS_MS),
  })
}

export function invalidateTenantCache(host?: string): void {
  // Удаление token'а вместе с cache + inflight: identity-check в
  // lookupTenantByHost увидит missing token и НЕ закэширует in-progress
  // результат поверх инвалидации.
  if (host !== undefined) {
    cache.delete(host)
    inflight.delete(host)
    inflightTokens.delete(host)
  } else {
    cache.clear()
    inflight.clear()
    inflightTokens.clear()
  }
}
