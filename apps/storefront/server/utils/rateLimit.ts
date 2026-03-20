type RateLimitEntry = { count: number; resetAt: number }

export function createRateLimiter(max: number, windowMs: number) {
  const map = new Map<string, RateLimitEntry>()

  // Очистка устаревших записей при каждой проверке (lazy cleanup)
  function cleanup() {
    const now = Date.now()
    for (const [key, entry] of map) {
      if (now > entry.resetAt) map.delete(key)
    }
  }

  return {
    check(ip: string): boolean {
      const now = Date.now()
      const entry = map.get(ip)

      if (!entry || now > entry.resetAt) {
        // Lazy cleanup: чистим при добавлении нового ключа
        if (map.size > 1000) cleanup()
        map.set(ip, { count: 1, resetAt: now + windowMs })
        return true
      }

      if (entry.count >= max) return false

      entry.count++
      return true
    },
  }
}
