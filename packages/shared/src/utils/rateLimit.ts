type RateLimitEntry = { count: number; resetAt: number }

export function createRateLimiter(max: number, windowMs: number) {
  const map = new Map<string, RateLimitEntry>()

  function cleanup() {
    const now = Date.now()

    for (const [key, entry] of map) {
      if (now > entry.resetAt) map.delete(key)
    }
  }

  return {
    check(key: string): boolean {
      const now = Date.now()
      const entry = map.get(key)

      if (!entry || now > entry.resetAt) {
        if (map.size > 1000) cleanup()

        map.set(key, { count: 1, resetAt: now + windowMs })

        return true
      }

      if (entry.count >= max) return false

      entry.count++

      return true
    },
  }
}
