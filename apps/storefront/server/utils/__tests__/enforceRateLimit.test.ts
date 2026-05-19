import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createError } from 'h3'

// h3 createError emit на global для совместимости с прод-кодом, который зовёт
// createError без import (Nuxt auto-import). Это же делает bulk.post.test.ts.
;(globalThis as Record<string, unknown>).createError = createError

const mockRpc = vi.fn()
vi.mock('../supabase', () => ({
  getServerSupabase: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }),
}))
const mockReportError = vi.fn()
vi.mock('~/shared/utils/reportError', () => ({
  reportError: (err: unknown) => mockReportError(err),
}))

const { enforceRateLimit } = await import('../enforceRateLimit')

beforeEach(() => {
  mockRpc.mockReset()
  mockReportError.mockReset()
})

describe('enforceRateLimit', () => {
  it('rules.length === 0 → не зовёт RPC и проходит', async () => {
    await expect(enforceRateLimit([], 'msg')).resolves.toBeUndefined()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('все правила прошли (data === true) → проходит без throw', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    await expect(
      enforceRateLimit(
        [
          { key: 'a:ip:1', max: 5, windowSeconds: 60 },
          { key: 'a:tenant-ip:t:1', max: 3, windowSeconds: 60 },
        ],
        'rejected',
      ),
    ).resolves.toBeUndefined()

    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('хотя бы одно правило вернуло data === false → throws 429', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null })

    await expect(
      enforceRateLimit(
        [
          { key: 'a:ip:1', max: 5, windowSeconds: 60 },
          { key: 'a:tenant-ip:t:1', max: 3, windowSeconds: 60 },
        ],
        'rejected',
      ),
    ).rejects.toMatchObject({ statusCode: 429, message: 'rejected' })

    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('RPC вернула error → fail-closed: throws 503 + reportError', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'db down' } })

    await expect(
      enforceRateLimit([{ key: 'a:ip:1', max: 5, windowSeconds: 60 }], 'rejected'),
    ).rejects.toMatchObject({ statusCode: 503 })

    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(mockReportError).toHaveBeenCalledWith({ message: 'db down' })
  })

  it('одно правило с error + другое с data:false → побеждает 503 (fail-closed первее)', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'fail' } })

    await expect(
      enforceRateLimit(
        [
          { key: 'a:ip:1', max: 5, windowSeconds: 60 },
          { key: 'a:tenant-ip:t:1', max: 3, windowSeconds: 60 },
        ],
        'rejected',
      ),
    ).rejects.toMatchObject({ statusCode: 503 })

    expect(mockReportError).toHaveBeenCalledTimes(1)
  })

  it('параметры RPC: _key/_max/_window_seconds передаются как заявлено', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })

    await enforceRateLimit(
      [{ key: 'foo:ip:1.2.3.4', max: 42, windowSeconds: 60 }],
      'rejected',
    )

    expect(mockRpc).toHaveBeenCalledWith('consume_rate_limit', {
      _key: 'foo:ip:1.2.3.4',
      _max: 42,
      _window_seconds: 60,
    })
  })
})
