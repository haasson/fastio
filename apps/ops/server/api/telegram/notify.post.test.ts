import { describe, it, vi } from 'vitest'

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({ internalApiSecret: 'test-secret', telegramTenantBotToken: 'test-token' }),
}))

describe('notify.post', () => {
  it.todo('processes order notification body')
  it.todo('returns 403 on missing auth')
})
