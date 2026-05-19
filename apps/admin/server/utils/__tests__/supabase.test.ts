
/**
 * PREPROD-120: getServerSupabase() возвращает singleton — один и тот же экземпляр
 * между вызовами, чтобы не плодить http-агенты. resetServerSupabase() сбрасывает
 * кеш для случая ротации service-role key без рестарта процесса.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const createClientMock = vi.fn((..._args: unknown[]) => ({ __id: Math.random() }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}))

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({
    public: { supabaseUrl: 'http://localhost:54321' },
    supabaseServiceRoleKey: 'test-service-role-key',
  }),
}))

describe('getServerSupabase singleton (PREPROD-120)', () => {
  beforeEach(() => {
    createClientMock.mockClear()
    vi.resetModules()
  })

  it('возвращает один и тот же экземпляр между вызовами', async () => {
    const mod = await import('../supabase')
    const a = mod.getServerSupabase()
    const b = mod.getServerSupabase()

    expect(a).toBe(b)
    expect(createClientMock).toHaveBeenCalledTimes(1)
  })

  it('resetServerSupabase() сбрасывает кеш — следующий вызов создаёт новый клиент', async () => {
    const mod = await import('../supabase')
    const first = mod.getServerSupabase()

    mod.resetServerSupabase()
    const second = mod.getServerSupabase()

    expect(first).not.toBe(second)
    expect(createClientMock).toHaveBeenCalledTimes(2)
  })

  it('createClient вызывается с supabaseUrl, service-role key и persistSession:false', async () => {
    const mod = await import('../supabase')

    mod.getServerSupabase()

    expect(createClientMock).toHaveBeenCalledWith(
      'http://localhost:54321',
      'test-service-role-key',
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  })
})
