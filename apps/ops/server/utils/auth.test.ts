import { describe, it, vi } from 'vitest'

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({ internalApiSecret: 'test-secret' }),
}))

describe('requireInternalSecret', () => {
  it.todo('returns 403 on wrong secret')
  it.todo('passes through on correct secret')
})
